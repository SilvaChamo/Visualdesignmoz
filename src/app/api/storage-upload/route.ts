import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createSessionClient, getVerifiedSession } from '@/utils/supabase/server';
import { compressImageToMaxSize } from '@/lib/image-compress';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB, mesmo limite dos outros endpoints de anexo

// Só os baldes que o painel usa (MultiFileUpload). Sem esta lista, quem chamasse a rota escolhia o balde
// (com a chave de serviço) e podia escrever em qualquer um.
const BALDES_PERMITIDOS = new Set(['ticket-attachments']);

// Anexos de documentos e imagens, cada extensão com o seu tipo. O tipo que o navegador diz (`file.type`) não conta: um
// "documento.pdf" declarado como text/html seria servido como página do nosso armazenamento. Fica de fora o que o
// navegador executa ao abrir o endereço público (html, svg, js…).
const TIPO_POR_EXTENSAO: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
};

export async function POST(req: NextRequest) {
  try {
    // Só quem tem sessão carrega ficheiros: o endereço devolvido é público e o armazenamento é nosso.
    const sessao = await getVerifiedSession(await createSessionClient());
    if (!sessao?.user) {
      return NextResponse.json({ error: 'A sua sessão expirou. Entre novamente para realizar esta acção.' }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get('file') as File | null;
    const bucket = String(form.get('bucket') || 'ticket-attachments');
    // A pasta só leva letras, números, hífen e sublinhado: nada de "../" nem de barras a escolher outro sítio.
    const pasta = String(form.get('folder') || 'attachments').replace(/[^a-z0-9_-]/gi, '') || 'attachments';

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 });
    }
    if (!BALDES_PERMITIDOS.has(bucket)) {
      return NextResponse.json({ error: 'Destino não permitido.' }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Ficheiro demasiado grande (máx. 10MB).' }, { status: 400 });
    }

    const partes = file.name.split('.');
    const ext = partes.length > 1 ? (partes.pop() || '').toLowerCase() : '';
    if (!Object.hasOwn(TIPO_POR_EXTENSAO, ext)) {
      return NextResponse.json({ error: 'Tipo de ficheiro não permitido (PDF, imagens, documentos e arquivos comprimidos).' }, { status: 400 });
    }
    const baseName = partes.join('.');
    const safeName = baseName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    // Cada utilizador escreve só na sua própria pasta.
    const path = `${pasta}/${sessao.user.id}/${Date.now()}-${safeName}.${ext}`;

    const bytes = await file.arrayBuffer();
    const { buffer, contentType } = await compressImageToMaxSize(
      Buffer.from(bytes),
      TIPO_POR_EXTENSAO[ext]
    );

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { data: publicData } = supabaseAdmin.storage.from(bucket).getPublicUrl(data.path);
    return NextResponse.json({ url: publicData.publicUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro de upload' }, { status: 500 });
  }
}
