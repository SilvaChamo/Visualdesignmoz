import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { mirrorAfterDaMutation } from '@/lib/panel-mirror-write';
import { installWordPressSite } from '@/lib/wp-cli-server';
import { getProviderByUsername } from '@/lib/hosting-provider';
import * as hestiaAdapter from '@/lib/hestia-adapter';

/** Dono real do domínio (username no servidor, DA ou Hestia) — 'admin' por
 * omissão quando não há registo próprio no mirror. */
async function resolveDomainOwner(domain: string): Promise<string> {
  const { resolveHostingOwner } = await import('@/lib/hosting-resolver');
  return resolveHostingOwner(domain);
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
    const owner = await resolveDomainOwner(domain);
    const provider = await getProviderByUsername(owner);

    if (provider !== 'hestia') {
      return NextResponse.json(
        { success: false, error: 'Este painel está configurado para hospedagem Hestia; o domínio não está associado a uma conta Hestia.' },
        { status: 409 },
      );
    }

    const dbResult = await hestiaAdapter.createDatabase({
      username: owner,
      dbNameSuffix: dbName,
      dbUserSuffix: dbUser,
      password: dbPassword,
    });
    if (!dbResult.ok) {
      return NextResponse.json(
        { success: false, error: dbResult.error || 'Falha ao criar base de dados no Hestia' },
        { status: 502 },
      );
    }

    // O Hestia prefixa sempre com "username_". O wp-config.php precisa dos
    // nomes completos devolvidos pela criação, não dos sufixos do formulário.
    const dbNameFinal = dbResult.database || `${owner}_${dbName}`;
    const dbUserFinal = dbResult.dbUser || `${owner}_${dbUser}`;

    await mirrorAfterDaMutation('createDatabase', { domain, dbName: dbNameFinal, dbUser: dbUserFinal, dbPassword });

    const result = await installWordPressSite({
      domain,
      directory: String(body.directory || '').trim(),
      siteTitle: String(body.siteName || domain).trim(),
      adminUser,
      adminPassword,
      adminEmail,
      dbName: dbNameFinal,
      dbUser: dbUserFinal,
      dbPassword,
      protocol: body.protocol === 'http' ? 'http' : 'https',
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.output }, { status: 502 });
    }

    await mirrorAfterDaMutation('installWordPress', { domain });
    const { runHestiaFullSyncDeduped } = await import('@/lib/hestia-sync-engine');
    void runHestiaFullSyncDeduped().catch((error) => {
      console.error('[wp-install] sincronização Hestia falhou após instalação:', error);
    });

    return NextResponse.json({ success: true, message: 'WordPress instalado com sucesso.', output: result.output });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro na instalação';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
