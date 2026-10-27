import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { ensureCompanyLogoBucket, COMPANY_LOGO_BUCKET } from '@/lib/company-logo-bucket';
import { resolveEffectivePanelUserId } from '@/lib/panel-reseller-context';
import { compressImageToMaxSize } from '@/lib/image-compress';

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB — é só um logótipo, não um anexo

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Logótipo próprio de cada conta (revendedor/cliente/profissional), usado no
// cabeçalho dos templates de Mailmarketing em vez do logo da VisualDesign —
// ver src/components/admin/EmailTemplates.tsx. Guardado em profiles.logo_url,
// a mesma tabela/coluna-por-utilizador já usada em "A Minha Conta"
// (src/app/cliente/page.tsx).
export async function GET() {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return NextResponse.json({ error: 'A sua sessão expirou. Entre novamente para realizar esta acção.' }, { status: 401 });
  const userId = await resolveEffectivePanelUserId(auth.user);

  const { data } = await admin()
    .from('profiles')
    .select('logo_url')
    .eq('user_id', userId)
    .maybeSingle();

  return NextResponse.json({ url: data?.logo_url || null });
}

export async function POST(request: NextRequest) {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return NextResponse.json({ error: 'A sua sessão expirou. Entre novamente para realizar esta acção.' }, { status: 401 });
  const userId = await resolveEffectivePanelUserId(auth.user);

  const form = await request.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Ficheiro em falta.' }, { status: 400 });
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'O ficheiro tem de ser uma imagem.' }, { status: 400 });
  if (file.size > MAX_SIZE_BYTES) return NextResponse.json({ error: 'Imagem demasiado grande (máx. 2MB).' }, { status: 400 });

  await ensureCompanyLogoBucket();

  const supabaseAdmin = admin();
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${userId}/${Date.now()}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { buffer, contentType } = await compressImageToMaxSize(Buffer.from(bytes), file.type);
  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from(COMPANY_LOGO_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });

  if (uploadError) {
    console.error('[mailmarketing-logo] upload error:', uploadError);
    return NextResponse.json({ error: 'Não foi possível enviar a imagem.' }, { status: 500 });
  }

  const { data: publicData } = supabaseAdmin.storage.from(COMPANY_LOGO_BUCKET).getPublicUrl(uploadData.path);

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  const { error: saveError } = existing?.id
    ? await supabaseAdmin.from('profiles').update({ logo_url: publicData.publicUrl, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : await supabaseAdmin.from('profiles').insert({ user_id: userId, email: userId === auth.user.id ? auth.user.email : undefined, logo_url: publicData.publicUrl, updated_at: new Date().toISOString() });

  if (saveError) {
    console.error('[mailmarketing-logo] save error:', saveError);
    return NextResponse.json({ error: 'Imagem enviada, mas não foi possível guardá-la na conta.' }, { status: 500 });
  }

  return NextResponse.json({ url: publicData.publicUrl });
}

export async function DELETE() {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return NextResponse.json({ error: 'A sua sessão expirou. Entre novamente para realizar esta acção.' }, { status: 401 });
  const userId = await resolveEffectivePanelUserId(auth.user);

  const { error } = await admin()
    .from('profiles')
    .update({ logo_url: null, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
