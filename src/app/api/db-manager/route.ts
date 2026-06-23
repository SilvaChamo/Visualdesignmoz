import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { listMirrorWebsites } from '@/lib/panel-mirror-read';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import { mirrorAfterDaMutation } from '@/lib/panel-mirror-write';
import {
  daDbChangeHosts,
  daDbChangePassword,
  daDbChangePrivs,
  daDbCheck,
  daDbCreateUser,
  daDbCreateWithUser,
  daDbDeleteDatabase,
  daDbDeleteUser,
  daDbExport,
  daDbFixDefiners,
  daDbGetDatabase,
  daDbGetInfo,
  daDbGetUser,
  daDbGrantFullAccess,
  daDbImport,
  daDbListDatabaseUsers,
  daDbListDatabases,
  daDbListUserDatabases,
  daDbListUsers,
  daDbOptimize,
  daDbRepair,
  daDbRevokeAccess,
  daPhpMyAdminSso,
  fullDbPrivileges,
} from '@/lib/da-database-api';

export const dynamic = 'force-dynamic';

async function resolveOwner(domain: string, explicitOwner?: string): Promise<string | null> {
  if (explicitOwner?.trim()) return explicitOwner.trim().toLowerCase();
  if (!domain) return null;
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return null;
  const { mirrorScope } = await resolvePanelDaContext(auth);
  const sites = await listMirrorWebsites(mirrorScope);
  const site = sites.find((s) => s.domain === domain);
  return site?.owner?.toLowerCase() || null;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  const sp = req.nextUrl.searchParams;
  const action = sp.get('action');
  const domain = sp.get('domain') || '';
  const database = sp.get('database') || '';
  const owner = await resolveOwner(domain, sp.get('owner') || undefined);
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Conta de hospedagem não encontrada.' }, { status: 400 });
  }

  if (action === 'export') {
    const gzip = sp.get('gzip') === '1' || sp.get('gzip') === 'yes';
    if (!database) {
      return NextResponse.json({ success: false, error: 'Base de dados em falta.' }, { status: 400 });
    }
    const result = await daDbExport(owner, database, gzip);
    if (!result.ok || !result.base64) {
      return NextResponse.json({ success: false, error: result.error || 'Exportação falhou.' }, { status: 502 });
    }
    const bytes = Buffer.from(result.base64, 'base64');
    const filename = `${database}${gzip ? '.sql.gz' : '.sql'}`;
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': gzip ? 'application/gzip' : 'application/sql',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json({ success: false, error: 'Acção inválida.' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const domain = String(form.get('domain') || '');
    const database = String(form.get('database') || '');
    const owner = await resolveOwner(domain, String(form.get('owner') || '') || undefined);
    const file = form.get('sqlfile');
    const clean = form.get('clean') === 'yes' || form.get('clean') === 'true';
    if (!owner || !database || !(file instanceof Blob)) {
      return NextResponse.json({ success: false, error: 'Dados de importação inválidos.' }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await daDbImport(owner, database, buf.toString('base64'), clean);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error || 'Importação falhou.' }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const action = String(body.action || '');
  const domain = String(body.domain || '');
  const owner = await resolveOwner(domain, String(body.owner || '') || undefined);
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Conta de hospedagem não encontrada.' }, { status: 400 });
  }

  const database = String(body.database || '');
  const dbuser = String(body.dbuser || body.dbUser || '');

  try {
    switch (action) {
      case 'getInfo': {
        const result = await daDbGetInfo(owner);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true, data: result.data });
      }
      case 'listDatabases': {
        const noSize = body.noSize === true;
        const result = await daDbListDatabases(owner, noSize);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        const rows = Array.isArray(result.data) ? result.data : [];
        const totalBytes = rows.reduce((sum: number, r: { sizeBytes?: number }) => sum + (Number(r.sizeBytes) || 0), 0);
        return NextResponse.json({ success: true, data: { rows, totalBytes } });
      }
      case 'getDatabase': {
        if (!database) return NextResponse.json({ success: false, error: 'Base de dados em falta.' }, { status: 400 });
        const result = await daDbGetDatabase(owner, database);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true, data: result.data });
      }
      case 'listDatabaseUsers': {
        if (!database) return NextResponse.json({ success: false, error: 'Base de dados em falta.' }, { status: 400 });
        const result = await daDbListDatabaseUsers(owner, database);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true, data: result.data });
      }
      case 'listUsers': {
        const result = await daDbListUsers(owner);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true, data: result.data });
      }
      case 'getUser': {
        if (!dbuser) return NextResponse.json({ success: false, error: 'Utilizador em falta.' }, { status: 400 });
        const result = await daDbGetUser(owner, dbuser);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true, data: result.data });
      }
      case 'listUserDatabases': {
        if (!dbuser) return NextResponse.json({ success: false, error: 'Utilizador em falta.' }, { status: 400 });
        const result = await daDbListUserDatabases(owner, dbuser);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true, data: result.data });
      }
      case 'createDatabase': {
        const suffix = String(body.name || body.dbName || '').trim();
        if (!suffix) return NextResponse.json({ success: false, error: 'Nome da base de dados em falta.' }, { status: 400 });
        const fullDb = suffix.startsWith(`${owner}_`) ? suffix : `${owner}_${suffix}`;
        const userSuffix = String(body.dbuser || body.dbUser || suffix).trim();
        const fullUser = userSuffix.startsWith(`${owner}_`) ? userSuffix : `${owner}_${userSuffix}`;
        const payload = {
          database: fullDb,
          dbuser: fullUser,
          password: String(body.password || body.dbPassword || ''),
          charset: String(body.charset || '') || undefined,
          collation: String(body.collation || '') || undefined,
          hostPatterns: Array.isArray(body.hostPatterns) ? body.hostPatterns.map(String) : undefined,
          privileges: body.advanced ? fullDbPrivileges() : undefined,
        };
        const result = await daDbCreateWithUser(owner, payload);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        await mirrorAfterDaMutation('createDatabase', {
          domain,
          dbName: fullDb,
          dbUser: fullUser,
          dbPassword: payload.password,
        });
        return NextResponse.json({ success: true, data: { ...(result.data as object), database: fullDb, dbuser: fullUser } });
      }
      case 'createUser': {
        const suffix = String(body.dbuser || body.dbUser || '').trim();
        if (!suffix) return NextResponse.json({ success: false, error: 'Nome do utilizador em falta.' }, { status: 400 });
        const fullUser = suffix.startsWith(`${owner}_`) ? suffix : `${owner}_${suffix}`;
        const password = String(body.password || '');
        if (!password) return NextResponse.json({ success: false, error: 'Senha em falta.' }, { status: 400 });
        const result = await daDbCreateUser(owner, {
          dbuser: fullUser,
          password,
          hostPatterns: Array.isArray(body.hostPatterns) ? body.hostPatterns.map(String) : undefined,
        });
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true, data: { dbuser: fullUser, ...(result.data as object) } });
      }
      case 'deleteDatabase': {
        if (!database) return NextResponse.json({ success: false, error: 'Base de dados em falta.' }, { status: 400 });
        const result = await daDbDeleteDatabase(owner, database, body.dropOrphanUsers !== false);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        await mirrorAfterDaMutation('deleteDatabase', { domain, dbName: database });
        return NextResponse.json({ success: true });
      }
      case 'deleteUser': {
        if (!dbuser) return NextResponse.json({ success: false, error: 'Utilizador em falta.' }, { status: 400 });
        const result = await daDbDeleteUser(owner, dbuser);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true });
      }
      case 'changePassword': {
        const newPassword = String(body.newPassword || body.password || '');
        if (!dbuser || !newPassword) {
          return NextResponse.json({ success: false, error: 'Utilizador e senha são obrigatórios.' }, { status: 400 });
        }
        const result = await daDbChangePassword(owner, dbuser, newPassword);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true });
      }
      case 'changeHosts': {
        const hosts = Array.isArray(body.hostPatterns) ? body.hostPatterns.map(String) : [];
        if (!dbuser || !hosts.length) {
          return NextResponse.json({ success: false, error: 'Hosts inválidos.' }, { status: 400 });
        }
        const result = await daDbChangeHosts(owner, dbuser, hosts);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true });
      }
      case 'grantAccess': {
        if (!dbuser || !database) {
          return NextResponse.json({ success: false, error: 'Dados em falta.' }, { status: 400 });
        }
        const result = await daDbGrantFullAccess(owner, dbuser, database);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true });
      }
      case 'revokeAccess': {
        if (!dbuser || !database) {
          return NextResponse.json({ success: false, error: 'Dados em falta.' }, { status: 400 });
        }
        const result = await daDbRevokeAccess(owner, dbuser, database);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true });
      }
      case 'changePrivs': {
        if (!dbuser || !database || !body.privileges) {
          return NextResponse.json({ success: false, error: 'Dados em falta.' }, { status: 400 });
        }
        const result = await daDbChangePrivs(owner, dbuser, database, body.privileges as Record<string, boolean>);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true });
      }
      case 'check':
      case 'repair':
      case 'optimize':
      case 'fixDefiners': {
        if (!database) return NextResponse.json({ success: false, error: 'Base de dados em falta.' }, { status: 400 });
        const fn =
          action === 'check' ? daDbCheck
            : action === 'repair' ? daDbRepair
              : action === 'optimize' ? daDbOptimize
                : daDbFixDefiners;
        const result = await fn(owner, database);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true, data: result.data });
      }
      case 'phpmyadminSso': {
        const result = await daPhpMyAdminSso(owner, database || undefined);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        const url = (result.data as { url?: string })?.url;
        if (!url) return NextResponse.json({ success: false, error: 'Ligação indisponível.' }, { status: 502 });
        return NextResponse.json({ success: true, data: { url } });
      }
      default:
        return NextResponse.json({ success: false, error: 'Acção desconhecida.' }, { status: 400 });
    }
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Erro interno.' },
      { status: 500 },
    );
  }
}
