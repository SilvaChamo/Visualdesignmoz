import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveQuotationAccess } from '@/lib/quotation-access';
import { ensureQuotationAttachmentsBucket, QUOTATION_ATTACHMENTS_BUCKET, getAttachmentSignedUrl, getAttachmentSignedUrls } from '@/lib/quotation-attachments-bucket';
import { compressImageToMaxSize } from '@/lib/image-compress';
import { notifyQuoteTeam } from '@/lib/notify-quote-team';
import { comprovativoFaseFromPath, comprovativoStoragePath, isComprovativoFase } from '@/lib/quotation-comprovativo';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB, mesmo limite por omissão de MultiFileUpload

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await resolveQuotationAccess(id);
  if (!access.ok) return access.response;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  }

  const { data, error } = await admin
    .from('quotation_attachments')
    .select('*')
    .in('quotation_id', access.batchQuotationIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[cotacoes/[id]/anexos] list error:', error);
    return NextResponse.json({ error: 'Não foi possível carregar os anexos.' }, { status: 500 });
  }

  // #11: bucket privado — file_url guardado é só o caminho. A fase do
  // comprovativo sai desse caminho (ver quotation-comprovativo.ts) antes de
  // ser trocado pelo URL assinado.
  const signedUrls = await getAttachmentSignedUrls((data || []).map((a) => a.file_url));
  const anexos = (data || []).map((a, idx) => ({
    ...a,
    file_url: signedUrls[idx],
    comprovativo_fase: comprovativoFaseFromPath(a.file_url),
  }));

  return NextResponse.json({ success: true, anexos });
}

// Upload directo (não passa por /api/storage-upload, que não valida dono
// nenhum) — o ownership check acontece aqui, antes de qualquer escrita.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await resolveQuotationAccess(id);
  if (!access.ok) return access.response;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get('file') as File | null;
  // Comprovativo de pagamento (adiantamento/remanescente) — marcado no
  // caminho do ficheiro para a Contabilidade › Encomendas o encontrar.
  const faseRaw = form.get('fase');
  const fase = isComprovativoFase(faseRaw) ? faseRaw : null;

  if (!file) {
    return NextResponse.json({ error: 'Ficheiro em falta.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Ficheiro demasiado grande (máx. 10MB).' }, { status: 400 });
  }

  await ensureQuotationAttachmentsBucket();

  const ext = file.name.split('.').pop() || 'bin';
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const safeName = baseName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const path = fase ? comprovativoStoragePath(id, fase, safeName, ext) : `${id}/${Date.now()}-${safeName}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { buffer, contentType } = await compressImageToMaxSize(
    Buffer.from(bytes),
    file.type || 'application/octet-stream'
  );

  const { data: uploadData, error: uploadError } = await admin.storage
    .from(QUOTATION_ATTACHMENTS_BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error('[cotacoes/[id]/anexos] upload error:', uploadError);
    return NextResponse.json({ error: 'Não foi possível enviar o ficheiro.' }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await admin
    .from('quotation_attachments')
    .insert({
      quotation_id: id,
      uploaded_by_role: access.role,
      file_name: file.name,
      file_url: uploadData.path,
      file_size_bytes: buffer.length,
    })
    .select()
    .single();

  if (insertError) {
    console.error('[cotacoes/[id]/anexos] insert error:', insertError);
    return NextResponse.json({ error: 'Não foi possível registar o anexo.' }, { status: 500 });
  }

  if (fase && access.role === 'client') {
    // Mesmo aviso que um comprovativo do checkout de domínio/hospedagem — a
    // equipa confirma na Contabilidade, não precisa de ir procurar o anexo.
    notifyQuoteTeam({
      title: 'Comprovativo de encomenda recebido',
      message: `${access.quotation.empresa} enviou o comprovativo do ${fase === 'remanescente' ? 'remanescente (30%)' : 'adiantamento (70%)'} da encomenda (${access.quotation.produto}). Confirme em Contabilidade › Encomendas.`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/dashboard?section=contabilidade`,
    }).catch((err) => console.error('[cotacoes/[id]/anexos] falha ao notificar equipa:', err));
  }

  const signedUrl = await getAttachmentSignedUrl(inserted.file_url);
  return NextResponse.json({ success: true, anexo: { ...inserted, file_url: signedUrl } });
}
