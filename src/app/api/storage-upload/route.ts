import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const bucket = (form.get('bucket') as string | null) || 'ticket-attachments';
    const folder = (form.get('folder') as string | null) || 'attachments';

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'bin';
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const safeName = baseName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const path = `${folder}/${Date.now()}-${safeName}.${ext}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
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
