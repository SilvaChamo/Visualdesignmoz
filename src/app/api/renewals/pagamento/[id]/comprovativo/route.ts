import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureQuotationAttachmentsBucket, QUOTATION_ATTACHMENTS_BUCKET, getAttachmentSignedUrl } from '@/lib/quotation-attachments-bucket';
import { compressImageToMaxSize } from '@/lib/image-compress';
import { comprovativoValido, COMPROVATIVO_ERRO } from '@/lib/comprovativo-ficheiro';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

// Comprovativo de pagamento de uma renovação — mesmo bucket dos anexos de
// cotação/crédito, só muda o prefixo da pasta.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  }

  const { id } = await params;

  const { data: pedido, error: pedidoError } = await admin
    .from('renewal_payment_requests')
    .select('id, user_id, status')
    .eq('id', id)
    .single();
  if (pedidoError || !pedido) {
    return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
  }
  if (pedido.user_id !== user.id) {
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
  if (!comprovativoValido(file)) {
    return NextResponse.json({ error: COMPROVATIVO_ERRO }, { status: 400 });
  }

  await ensureQuotationAttachmentsBucket();

  const ext = file.name.split('.').pop() || 'bin';
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const safeName = baseName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const path = `renovacao/${id}/${Date.now()}-${safeName}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { buffer, contentType } = await compressImageToMaxSize(
    Buffer.from(bytes),
    file.type || 'application/octet-stream'
  );

  const { data: uploadData, error: uploadError } = await admin.storage
    .from(QUOTATION_ATTACHMENTS_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (uploadError) {
    console.error('[renewals/pagamento comprovativo] upload error:', uploadError);
    return NextResponse.json({ error: 'Não foi possível enviar o ficheiro.' }, { status: 500 });
  }

  const { data: updated, error: updateError } = await admin
    .from('renewal_payment_requests')
    .update({ comprovativo_url: uploadData.path })
    .eq('id', id)
    .select()
    .single();
  if (updateError) {
    console.error('[renewals/pagamento comprovativo] update error:', updateError);
    return NextResponse.json({ error: 'Não foi possível registar o comprovativo.' }, { status: 500 });
  }

  const signedUrl = await getAttachmentSignedUrl(updated.comprovativo_url);
  return NextResponse.json({ success: true, pedido: { ...updated, comprovativo_url: signedUrl } });
}
