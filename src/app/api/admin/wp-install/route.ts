import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { createDirectAdminAPI, getAdminDirectAdminAPI } from '@/lib/directadmin-adapter';
import { loadResellerCredentialsByDaUsername } from '@/lib/da-credential-store';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { mirrorAfterDaMutation } from '@/lib/panel-mirror-write';
import { installWordPressSite } from '@/lib/wp-cli-server';

async function daApiForDomain(domain: string) {
  const admin = getDaSyncAdmin();
  let owner = 'admin';
  if (admin) {
    const { data } = await admin.from('panel_sites').select('owner').eq('domain', domain).maybeSingle();
    if (data?.owner) owner = String(data.owner);
  }

  if (!owner || owner === 'admin') return getAdminDirectAdminAPI();

  const stored = await loadResellerCredentialsByDaUsername(String(owner));
  if (!stored) return getAdminDirectAdminAPI();
  return createDirectAdminAPI({ role: 'reseller', user: stored.user, password: stored.password });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const domain = String(body.domain || '').trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ success: false, error: 'Domínio obrigatório' }, { status: 400 });
  }

  const adminUser = String(body.adminUsername || body.adminUser || 'admin').trim();
  const adminPassword = String(body.adminPassword || '').trim();
  const adminEmail = String(body.adminEmail || '').trim();
  const dbName = String(body.databaseName || body.dbName || '').trim();
  const dbUser = String(body.databaseUser || body.dbUser || dbName).trim();
  const dbPassword = String(body.databasePassword || body.dbPass || '').trim();

  if (!adminPassword || !adminEmail || !dbName || !dbUser || !dbPassword) {
    return NextResponse.json({ success: false, error: 'Campos obrigatórios em falta' }, { status: 400 });
  }

  try {
    const da = await daApiForDomain(domain);
    await da.createDatabase({
      domain,
      dbName,
      dbUser,
      dbPassword,
    });
    await mirrorAfterDaMutation('createDatabase', { domain, dbName, dbUser, dbPassword });

    const result = await installWordPressSite({
      domain,
      directory: String(body.directory || '').trim(),
      siteTitle: String(body.siteName || domain).trim(),
      adminUser,
      adminPassword,
      adminEmail,
      dbName,
      dbUser,
      dbPassword,
      protocol: body.protocol === 'http' ? 'http' : 'https',
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.output }, { status: 502 });
    }

    await mirrorAfterDaMutation('installWordPress', { domain });

    return NextResponse.json({ success: true, message: 'WordPress instalado com sucesso.', output: result.output });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro na instalação';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
