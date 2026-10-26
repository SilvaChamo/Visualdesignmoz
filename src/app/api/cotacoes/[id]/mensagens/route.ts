import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveQuotationAccess } from '@/lib/quotation-access';
import { notifyQuoteTeam } from '@/lib/notify-quote-team';
import { notifyQuoteClientNewMessage } from '@/lib/notify-quote-client';
import { ensureQuotationAttachmentsBucket, QUOTATION_ATTACHMENTS_BUCKET, getAttachmentSignedUrl, getAttachmentSignedUrls } from '@/lib/quotation-attachments-bucket';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES: Record<string, 'image' | 'pdf'> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'application/pdf': 'pdf',
};

// Chat por encomenda, partilhado entre o painel do cliente e o painel admin.
// resolveQuotationAccess decide se quem pede é o dono ('client') ou a equipa
// ('admin'), e isso define o sender_role gravado. Anexos (PDF/JPEG/PNG)
// vivem na própria mensagem — Layouts e Anexos deixaram de ser abas
// separadas, tudo fica nesta conversa.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await resolveQuotationAccess(id);
  if (!access.ok) return access.response;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  }

  const { data, error } = await admin
    .from('quotation_messages')
    .select('*')
    .in('quotation_id', access.batchQuotationIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[cotacoes/[id]/mensagens] list error:', error);
    return NextResponse.json({ error: 'Não foi possível carregar as mensagens.' }, { status: 500 });
  }

  // #11: bucket privado — attachment_url guardado é só o caminho.
  const signedUrls = await getAttachmentSignedUrls((data || []).map((m) => m.attachment_url));
  const mensagens = (data || []).map((m, idx) => ({ ...m, attachment_url: signedUrls[idx] }));

  return NextResponse.json({ success: true, mensagens });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await resolveQuotationAccess(id);
  if (!access.ok) return access.response;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  }

  const contentType = request.headers.get('content-type') || '';
  let message = '';
  let attachment: { url: string; name: string; type: 'image' | 'pdf' } | null = null;

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    message = String(form.get('message') || '').trim();
    const file = form.get('file') as File | null;

    if (file) {
      const kind = ALLOWED_TYPES[file.type];
      if (!kind) {
        return NextResponse.json({ error: 'Só são aceites ficheiros PDF, JPEG ou PNG.' }, { status: 400 });
      }
      if (file.size > MAX_SIZE_BYTES) {
        return NextResponse.json({ error: 'Ficheiro demasiado grande (máx. 10MB).' }, { status: 400 });
      }

      await ensureQuotationAttachmentsBucket();
      const ext = file.name.split('.').pop() || 'bin';
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const safeName = baseName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const path = `${id}/${Date.now()}-${safeName}.${ext}`;
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const { data: uploadData, error: uploadError } = await admin.storage
        .from(QUOTATION_ATTACHMENTS_BUCKET)
        .upload(path, buffer, { contentType: file.type, upsert: false });

      if (uploadError) {
        console.error('[cotacoes/[id]/mensagens] upload error:', uploadError);
        return NextResponse.json({ error: 'Não foi possível enviar o ficheiro.' }, { status: 500 });
      }

      attachment = { url: uploadData.path, name: file.name, type: kind };
    }
  } else {
    const body = await request.json().catch(() => ({}));
    message = typeof body?.message === 'string' ? body.message.trim() : '';
  }

  if (!message && !attachment) {
    return NextResponse.json({ error: 'Escreva uma mensagem ou anexe um ficheiro.' }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'Mensagem demasiado longa (máx. 2000 caracteres).' }, { status: 400 });
  }

  const { data: inserted, error } = await admin
    .from('quotation_messages')
    .insert({
      quotation_id: id,
      sender_role: access.role,
      sender_user_id: access.userId,
      message: message || null,
      attachment_url: attachment?.url ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_type: attachment?.type ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('[cotacoes/[id]/mensagens] insert error:', error);
    return NextResponse.json({ error: 'Não foi possível enviar a mensagem.' }, { status: 500 });
  }

  if (inserted.attachment_url) {
    inserted.attachment_url = await getAttachmentSignedUrl(inserted.attachment_url);
  }

  const quotation = access.quotation;
  if (access.role === 'client') {
    notifyQuoteTeam({
      title: 'Nova mensagem do cliente',
      message: `${quotation.empresa} enviou uma nova mensagem sobre a encomenda "${quotation.produto}". Aceda ao painel para ler e responder.`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/vhost:2026`,
    }).catch((err) => console.error('[cotacoes/[id]/mensagens] falha ao notificar equipa:', err));
  } else {
    notifyQuoteClientNewMessage({
      to: quotation.email,
      clientName: quotation.responsavel || quotation.empresa,
      userId: quotation.user_id,
      produto: quotation.produto,
      quotationId: id,
    }).catch((err) => console.error('[cotacoes/[id]/mensagens] falha ao notificar cliente:', err));
  }

  return NextResponse.json({ success: true, mensagem: inserted });
}
