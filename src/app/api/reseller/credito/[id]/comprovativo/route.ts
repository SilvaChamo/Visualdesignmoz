import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResellerOrManager } from '@/lib/panel-api-auth';
import { resolveResellerPanelContext } from '@/lib/panel-reseller-context';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureQuotationAttachmentsBucket, QUOTATION_ATTACHMENTS_BUCKET, getAttachmentSignedUrl } from '@/lib/quotation-attachments-bucket';
import { compressImageToMaxSize } from '@/lib/image-compress';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB, mesmo limite dos anexos de cotação

// Comprovativo de pagamento de um pedido de carregamento — reutiliza o
// bucket dos anexos de cotação (mesma infra já testada), só muda o prefixo
// da pasta para "credito/".
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminResellerOrManager();
  if ('error' in auth) return auth.error;

  const ctx = await resolveResellerPanelContext(auth);
  if (!ctx) {
    return NextResponse.json({ error: 'Esta conta não é de revendedor.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  }

  const { id } = await params;

  const { data: pedido, error: pedidoError } = await supabase
    .from('reseller_credit_requests')
    .select('id, da_username, status')
    .eq('id', id)
    .single();
  if (pedidoError || !pedido) {
    return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
  }
  if (pedido.da_username !== ctx.mainAccount) {
    return NextResponse.json({ error: 'Não tem permissão para editar este pedido.' }, { status: 403 });
  }
  if (pedido.status !== 'pending') {
    return NextResponse.json({ error: 'Este pedido já foi respondido pela equipa.' }, { status: 409 });
  }

  const form = await request.formData();
  const file = form.get('file') as File | null;
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
  const path = `credito/${id}/${Date.now()}-${safeName}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { buffer, contentType } = await compressImageToMaxSize(
    Buffer.from(bytes),
    file.type || 'application/octet-stream'
  );

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(QUOTATION_ATTACHMENTS_BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: false,
    });
  if (uploadError) {
    console.error('[reseller/credito comprovativo] upload error:', uploadError);
    return NextResponse.json({ error: 'Não foi possível enviar o ficheiro.' }, { status: 500 });
  }

  const { data: updated, error: updateError } = await supabase
    .from('reseller_credit_requests')
    .update({ comprovativo_url: uploadData.path })
    .eq('id', id)
    .select()
    .single();
  if (updateError) {
    console.error('[reseller/credito comprovativo] update error:', updateError);
    return NextResponse.json({ error: 'Não foi possível registar o comprovativo.' }, { status: 500 });
  }

  const signedUrl = await getAttachmentSignedUrl(updated.comprovativo_url);
  return NextResponse.json({ success: true, pedido: { ...updated, comprovativo_url: signedUrl } });
}
