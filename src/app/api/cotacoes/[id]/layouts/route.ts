import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveQuotationAccess } from '@/lib/quotation-access';
import { ensureQuotationLayoutsBucket, QUOTATION_LAYOUTS_BUCKET } from '@/lib/quotation-layouts-bucket';
import { notifyQuoteClientNewLayout } from '@/lib/notify-quote-client';
import { compressImageToMaxSize } from '@/lib/image-compress';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB, mesmo limite dos anexos

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await resolveQuotationAccess(id);
  if (!access.ok) return access.response;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  }

  const { data, error } = await admin
    .from('quotation_layouts')
    .select('*')
    .in('quotation_id', access.batchQuotationIds)
    .order('fase', { ascending: true });

  if (error) {
    console.error('[cotacoes/[id]/layouts] list error:', error);
    return NextResponse.json({ error: 'Não foi possível carregar os layouts.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, layouts: data || [] });
}

// Só a equipa envia layouts — o cliente só vê/descarrega. A fase é sempre
// automática (1, 2, 3... por ordem de envio nesta encomenda); a equipa só
// escreve a descrição dessa fase.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await resolveQuotationAccess(id);
  if (!access.ok) return access.response;

  if (access.role !== 'admin') {
    return NextResponse.json({ error: 'Só a equipa pode enviar layouts.' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get('file') as File | null;
  const descricao = String(form.get('descricao') || '').trim();
  const mensagem = String(form.get('mensagem') || '').trim();

  if (!file) {
    return NextResponse.json({ error: 'Ficheiro em falta.' }, { status: 400 });
  }
  if (!descricao) {
    return NextResponse.json({ error: 'Escreva uma descrição para esta fase.' }, { status: 400 });
  }
  if (descricao.length > 255) {
    return NextResponse.json({ error: 'Descrição demasiado longa (máx. 255 caracteres).' }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Ficheiro demasiado grande (máx. 10MB).' }, { status: 400 });
  }

  const { count } = await admin
    .from('quotation_layouts')
    .select('id', { count: 'exact', head: true })
    .in('quotation_id', access.batchQuotationIds);
  const fase = (count || 0) + 1;

  await ensureQuotationLayoutsBucket();

  const ext = file.name.split('.').pop() || 'bin';
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const safeName = baseName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const path = `${id}/${Date.now()}-${safeName}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { buffer, contentType } = await compressImageToMaxSize(
    Buffer.from(bytes),
    file.type || 'application/octet-stream'
  );

  const { data: uploadData, error: uploadError } = await admin.storage
    .from(QUOTATION_LAYOUTS_BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error('[cotacoes/[id]/layouts] upload error:', uploadError);
    return NextResponse.json({ error: 'Não foi possível enviar o ficheiro.' }, { status: 500 });
  }

  const { data: publicData } = admin.storage.from(QUOTATION_LAYOUTS_BUCKET).getPublicUrl(uploadData.path);

  const { data: inserted, error: insertError } = await admin
    .from('quotation_layouts')
    .insert({
      quotation_id: id,
      fase,
      descricao,
      file_name: file.name,
      file_url: publicData.publicUrl,
      file_size_bytes: buffer.length,
    })
    .select()
    .single();

  if (insertError) {
    console.error('[cotacoes/[id]/layouts] insert error:', insertError);
    return NextResponse.json({ error: 'Não foi possível registar o layout.' }, { status: 500 });
  }

  // Mensagem opcional que acompanha o layout — entra na mesma conversa da
  // encomenda, para o cliente ter tudo (ficheiro + contexto) num sítio só.
  if (mensagem) {
    const { error: messageError } = await admin.from('quotation_messages').insert({
      quotation_id: id,
      sender_role: 'admin',
      sender_user_id: access.userId,
      message: mensagem,
    });
    if (messageError) {
      console.error('[cotacoes/[id]/layouts] falha ao gravar mensagem associada:', messageError);
    }
  }

  // Regista no histórico da encomenda (mesma tabela usada pelas mudanças de
  // estado e pela decisão de aprovação em [layoutId]/route.ts) — para o
  // envio da fase e a decisão do cliente aparecerem juntos no mesmo
  // QuotationHistoryTimeline, não espalhados por secções diferentes.
  try {
    await admin.from('quotation_status_history').insert({
      quotation_id: id,
      status: access.quotation.status,
      note: `Layout Fase ${fase} ("${descricao}") enviado pela equipa.`,
      changed_by: 'admin',
    });
  } catch (historyError) {
    console.error('[cotacoes/[id]/layouts] falha ao registar histórico:', historyError);
  }

  const quotation = access.quotation;
  notifyQuoteClientNewLayout({
    to: quotation.email,
    clientName: quotation.responsavel || quotation.empresa,
    userId: quotation.user_id,
    produto: quotation.produto,
    descricao,
    fase,
  }).catch((err) => console.error('[cotacoes/[id]/layouts] falha ao notificar cliente:', err));

  return NextResponse.json({ success: true, layout: inserted });
}
