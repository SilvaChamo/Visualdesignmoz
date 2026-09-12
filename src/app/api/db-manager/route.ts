import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResellerOrManager } from '@/lib/panel-api-auth';
import { resolveHostingOwner } from '@/lib/hosting-resolver';
import { mirrorAfterDaMutation } from '@/lib/panel-mirror-write';
import { getProviderByUsername, isHestiaOnlyDeploy } from '@/lib/hosting-provider';
import * as hestiaAdapter from '@/lib/hestia-adapter';
import * as hestiaMysql from '@/lib/hestia-mysql-acl';
import { createPhpMyAdminSsoUrl } from '@/lib/hestia-pma-sso';
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
export const maxDuration = 300;

async function resolveOwner(domain: string): Promise<string | null> {
  if (!domain) return null;
  const auth = await requireAdminResellerOrManager();
  if ('error' in auth) return null;
  return (await resolveHostingOwner(domain)).toLowerCase();
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminResellerOrManager();
  if ('error' in auth) return auth.error;

  const sp = req.nextUrl.searchParams;
  const action = sp.get('action');
  const domain = sp.get('domain') || '';
  const database = sp.get('database') || '';
  const owner = await resolveOwner(domain);
  if (action === 'phpmyadminSso') {
    const hestiaOwner =
      owner ||
      (isHestiaOnlyDeploy() ? (process.env.HESTIA_USER || 'vdadmin').trim().toLowerCase() : '');
    if (hestiaOwner && (isHestiaOnlyDeploy() || (await getProviderByUsername(hestiaOwner)) === 'hestia')) {
      try {
        const url = await createPhpMyAdminSsoUrl(hestiaOwner, database || undefined);
        const dest = new URL(url, req.nextUrl.origin);
        const res = NextResponse.redirect(dest, 302);
        res.headers.set('Cache-Control', 'no-store');
        return res;
      } catch (e: unknown) {
        return NextResponse.json(
          { success: false, error: e instanceof Error ? e.message : 'Não foi possível abrir o MySQL.' },
          { status: 502 },
        );
      }
    }
  }
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Conta de hospedagem não encontrada.' }, { status: 400 });
  }

  if (action === 'export') {
    const gzip = sp.get('gzip') === '1' || sp.get('gzip') === 'yes';
    if (!database) {
      return NextResponse.json({ success: false, error: 'Base de dados em falta.' }, { status: 400 });
    }
    const provider = await getProviderByUsername(owner);
    if (provider === 'hestia') {
      const dumped = await hestiaAdapter.exportDatabaseBytes(database, gzip);
      if (!dumped.ok || !dumped.bytes) {
        return NextResponse.json({ success: false, error: dumped.error || 'Exportação falhou.' }, { status: 502 });
      }
      const filename = `${database}${gzip ? '.sql.gz' : '.sql'}`;
      return new NextResponse(new Uint8Array(dumped.bytes), {
        headers: {
          'Content-Type': gzip ? 'application/gzip' : 'application/sql',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }
    const result = await daDbExport(owner, database, gzip);
    if (!result.ok || !result.base64) {
      return NextResponse.json({ success: false, error: result.error || 'Exportação falhou.' }, { status: 502 });
    }
    const bytes = Buffer.from(result.base64, 'base64');
    const filename = `${database}${gzip ? '.sql.gz' : '.sql'}`;
    return new NextResponse(new Uint8Array(bytes), {
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
  const auth = await requireAdminResellerOrManager();
  if ('error' in auth) return auth.error;

  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Ficheiro demasiado grande ou inválido. Tente um .sql.gz (máx. 512 MB).' },
        { status: 413 },
      );
    }
    const domain = String(form.get('domain') || '');
    const database = String(form.get('database') || '');
    const owner = await resolveOwner(domain);
    const file = form.get('sqlfile');
    const clean = form.get('clean') === 'yes' || form.get('clean') === 'true';
    if (!owner || !database || !(file instanceof Blob)) {
      return NextResponse.json({ success: false, error: 'Dados de importação inválidos.' }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const fileName = file instanceof File ? file.name : String(form.get('filename') || '');
    const provider = await getProviderByUsername(owner);
    if (provider === 'hestia') {
      const result = await hestiaAdapter.importDatabaseFile(database, buf, clean, fileName);
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error || 'Importação falhou.' }, { status: 502 });
      }
      await hestiaAdapter.refreshDatabaseDisk(owner, database).catch(() => undefined);
      const stats = await hestiaMysql.listMysqlSchemaStats([database]).catch(
        () => new Map<string, { sizeBytes: number; tableCount: number }>(),
      );
      const live = stats.get(database);
      return NextResponse.json({
        success: true,
        data: {
          sizeBytes: live?.sizeBytes ?? 0,
          tableCount: live?.tableCount ?? 0,
        },
      });
    }
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
  const owner = await resolveOwner(domain);
  if (!owner) {
    if (action === 'phpmyadminSso' && isHestiaOnlyDeploy()) {
      try {
        const url = await createPhpMyAdminSsoUrl(
          (process.env.HESTIA_USER || 'vdadmin').trim().toLowerCase(),
          String(body.database || '') || undefined,
        );
        return NextResponse.json({ success: true, data: { url } });
      } catch (e: unknown) {
        return NextResponse.json(
          { success: false, error: e instanceof Error ? e.message : 'Não foi possível abrir o MySQL.' },
          { status: 502 },
        );
      }
    }
    return NextResponse.json({ success: false, error: 'Conta de hospedagem não encontrada.' }, { status: 400 });
  }

  const database = String(body.database || '');
  const dbuser = String(body.dbuser || body.dbUser || '');

  const provider = await getProviderByUsername(owner);
  if (provider === 'hestia') {
    return handleHestiaDatabaseAction(action, owner, database, body, domain);
  }

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

/**
 * Bases de dados para contas Hestia — o modelo do Hestia é mais simples que o
 * da DirectAdmin (1 base de dados = sempre 1 utilizador dedicado, sem
 * privilégios/hosts geríveis à parte), por isso só cobre o CRUD essencial
 * (listar/criar/apagar/mudar password). Acções avançadas específicas da DA
 * (utilizadores separados, privilégios, hosts). phpMyAdmin abre no hostname
 * do painel Hestia (`/phpmyadmin/`), não na porta 2222 do DirectAdmin.
 */
async function handleHestiaDatabaseAction(
  action: string,
  owner: string,
  database: string,
  body: Record<string, unknown>,
  domain: string,
): Promise<NextResponse> {
  const hestiaUnsupported =
    'Esta operação não está disponível no Hestia.';

  try {
    switch (action) {
      case 'getInfo': {
        return NextResponse.json({
          success: true,
          data: { dbLimit: null, userLimit: null, mysql: true },
        });
      }
      case 'listDatabases': {
        const noSize = body.noSize === true;
        const hestiaRows = await hestiaAdapter.listDatabases(owner);
        const mysqlSchemas = await hestiaMysql.listMysqlSchemas(owner).catch(() => [] as string[]);
        const byName = new Map(hestiaRows.map((r) => [r.database, r]));
        for (const schema of mysqlSchemas) {
          if (!byName.has(schema)) {
            byName.set(schema, {
              database: schema,
              dbUser: '',
              host: 'localhost',
              type: 'mysql',
              charset: 'utf8mb4',
              diskUsedMb: 0,
              suspended: false,
            });
          }
        }
        const rows = [...byName.values()];
        const userCounts = await hestiaMysql.countUsersPerDatabase(
          owner,
          rows.map((r) => r.database),
        );
        const mysqlStats = noSize
          ? new Map<string, { sizeBytes: number; tableCount: number }>()
          : await hestiaMysql.listMysqlSchemaStats(rows.map((r) => r.database)).catch(
              () => new Map<string, { sizeBytes: number; tableCount: number }>(),
            );
        const data = rows.map((r) => {
          const live = mysqlStats.get(r.database);
          return {
            database: r.database,
            dbuser: r.dbUser,
            type: r.type,
            charset: r.charset,
            sizeBytes: live?.sizeBytes ?? r.diskUsedMb * 1024 * 1024,
            userCount: userCounts.get(r.database) ?? (r.dbUser ? 1 : 0),
            tableCount: live?.tableCount ?? 0,
            suspended: r.suspended,
          };
        });
        const totalBytes = data.reduce((sum, r) => sum + r.sizeBytes, 0);
        return NextResponse.json({ success: true, data: { rows: data, totalBytes } });
      }
      case 'getDatabase': {
        if (!database) return NextResponse.json({ success: false, error: 'Base de dados em falta.' }, { status: 400 });
        const details = await hestiaAdapter.getDatabaseDetails(owner, database);
        if (!details) return NextResponse.json({ success: false, error: 'Base de dados não encontrada.' }, { status: 404 });
        const dbUsers = await hestiaMysql.listDatabaseUsersFromMysql(owner, database).catch(() => []);
        return NextResponse.json({
          success: true,
          data: {
            database: details.database,
            defaultCharset: details.defaultCharset,
            defaultCollation: details.defaultCollation,
            sizeBytes: details.sizeBytes,
            userCount: dbUsers.length || details.userCount,
            tableCount: details.tableCount,
            viewCount: details.viewCount,
            eventCount: details.eventCount,
            triggerCount: details.triggerCount,
            routineCount: details.routineCount,
          },
        });
      }
      case 'listDatabaseUsers': {
        if (!database) return NextResponse.json({ success: false, error: 'Base de dados em falta.' }, { status: 400 });
        const data = await hestiaMysql.listDatabaseUsersFromMysql(owner, database);
        return NextResponse.json({ success: true, data });
      }
      case 'listUsers': {
        const users = await hestiaMysql.listMysqlUsers(owner);
        return NextResponse.json({ success: true, data: users });
      }
      case 'getUser': {
        const dbuser = String(body.dbuser || body.dbUser || '');
        if (!dbuser) return NextResponse.json({ success: false, error: 'Utilizador em falta.' }, { status: 400 });
        const row = await hestiaMysql.getMysqlUser(owner, dbuser);
        if (!row) return NextResponse.json({ success: false, error: 'Utilizador não encontrado.' }, { status: 404 });
        return NextResponse.json({ success: true, data: row });
      }
      case 'listUserDatabases': {
        const dbuser = String(body.dbuser || body.dbUser || '');
        if (!dbuser) return NextResponse.json({ success: false, error: 'Utilizador em falta.' }, { status: 400 });
        const data = await hestiaMysql.listUserDatabasesFromMysql(owner, dbuser);
        return NextResponse.json({ success: true, data });
      }
      case 'createDatabase': {
        const rawSuffix = String(body.name || body.dbName || '').trim();
        if (!rawSuffix) return NextResponse.json({ success: false, error: 'Nome da base de dados em falta.' }, { status: 400 });
        const dbNameSuffix = rawSuffix.startsWith(`${owner}_`) ? rawSuffix.slice(owner.length + 1) : rawSuffix;
        const rawUserSuffix = String(body.dbuser || body.dbUser || '').trim();
        const charset = String(body.charset || '').trim() || undefined;
        if (!rawUserSuffix) {
          try {
            const created = await hestiaMysql.createMysqlDatabase(owner, dbNameSuffix, charset);
            return NextResponse.json({ success: true, data: { database: created.database, dbuser: '' } });
          } catch (e: unknown) {
            return NextResponse.json(
              { success: false, error: e instanceof Error ? e.message : 'Não foi possível criar a base de dados.' },
              { status: 502 },
            );
          }
        }
        const dbUserSuffix = rawUserSuffix.startsWith(`${owner}_`) ? rawUserSuffix.slice(owner.length + 1) : rawUserSuffix;
        const password = String(body.password || body.dbPassword || '');
        if (!password) return NextResponse.json({ success: false, error: 'Senha em falta para criar o utilizador.' }, { status: 400 });
        const result = await hestiaAdapter.createDatabase({
          username: owner,
          dbNameSuffix,
          dbUserSuffix,
          password,
          charset,
        });
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        await hestiaMysql.rememberDatabaseSecret(owner, password, {
          database: result.database,
          dbuser: result.dbUser,
        });
        return NextResponse.json({ success: true, data: { database: result.database, dbuser: result.dbUser, password } });
      }
      case 'createUser': {
        const rawSuffix = String(body.dbuser || body.dbUser || '').trim();
        const password = String(body.password || '');
        if (!rawSuffix) return NextResponse.json({ success: false, error: 'Nome do utilizador em falta.' }, { status: 400 });
        if (!password) return NextResponse.json({ success: false, error: 'Senha em falta.' }, { status: 400 });
        try {
          const created = await hestiaMysql.createMysqlUser(owner, rawSuffix, password);
          await hestiaMysql.rememberDatabaseSecret(owner, password, { dbuser: created.dbuser });
          return NextResponse.json({ success: true, data: { dbuser: created.dbuser, password } });
        } catch (e: unknown) {
          return NextResponse.json(
            { success: false, error: e instanceof Error ? e.message : 'Não foi possível criar o utilizador.' },
            { status: 502 },
          );
        }
      }
      case 'deleteDatabase': {
        if (!database) return NextResponse.json({ success: false, error: 'Base de dados em falta.' }, { status: 400 });
        const hestiaRows = await hestiaAdapter.listDatabases(owner);
        if (hestiaRows.some((r) => r.database === database)) {
          const result = await hestiaAdapter.deleteDatabase(owner, database);
          if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
          return NextResponse.json({ success: true });
        }
        try {
          await hestiaMysql.dropMysqlDatabase(owner, database);
          return NextResponse.json({ success: true });
        } catch (e: unknown) {
          return NextResponse.json(
            { success: false, error: e instanceof Error ? e.message : 'Não foi possível eliminar a base de dados.' },
            { status: 502 },
          );
        }
      }
      case 'deleteUser': {
        const dbuser = String(body.dbuser || body.dbUser || '');
        if (!dbuser) return NextResponse.json({ success: false, error: 'Utilizador em falta.' }, { status: 400 });
        try {
          await hestiaMysql.dropMysqlUser(owner, dbuser);
          return NextResponse.json({ success: true });
        } catch (e: unknown) {
          return NextResponse.json(
            { success: false, error: e instanceof Error ? e.message : 'Não foi possível eliminar o utilizador.' },
            { status: 502 },
          );
        }
      }
      case 'changePassword': {
        const newPassword = String(body.newPassword || body.password || '');
        const dbuser = String(body.dbuser || body.dbUser || '');
        if ((!database && !dbuser) || !newPassword) {
          return NextResponse.json({ success: false, error: 'Utilizador e senha são obrigatórios.' }, { status: 400 });
        }
        try {
          let targetUser = dbuser;
          if (!targetUser && database) {
            const rows = await hestiaAdapter.listDatabases(owner);
            targetUser = rows.find((r) => r.database === database)?.dbUser || '';
          }
          if (!targetUser) {
            return NextResponse.json({ success: false, error: 'Utilizador não encontrado.' }, { status: 404 });
          }
          const changed = await hestiaMysql.changeMysqlUserPassword(owner, targetUser, newPassword);
          if (changed.hestiaDatabase) {
            await hestiaAdapter.changeDatabasePassword(owner, changed.hestiaDatabase, newPassword);
          }
          await hestiaMysql.rememberDatabaseSecret(owner, newPassword, {
            dbuser: targetUser,
            database: changed.hestiaDatabase,
          });
          return NextResponse.json({ success: true, data: { password: newPassword } });
        } catch (e: unknown) {
          return NextResponse.json(
            { success: false, error: e instanceof Error ? e.message : 'Não foi possível alterar a senha.' },
            { status: 502 },
          );
        }
      }
      case 'revealPassword': {
        const dbuser = String(body.dbuser || body.dbUser || '');
        if (!dbuser && !database) {
          return NextResponse.json({ success: false, error: 'Utilizador em falta.' }, { status: 400 });
        }
        try {
          let targetUser = dbuser;
          if (!targetUser && database) {
            const rows = await hestiaAdapter.listDatabases(owner);
            targetUser = rows.find((r) => r.database === database)?.dbUser || '';
          }
          if (!targetUser) {
            return NextResponse.json({ success: true, data: { password: null } });
          }
          const password = await hestiaMysql.revealPasswordFromWpConfig(
            owner,
            targetUser,
            database || undefined,
            domain || undefined,
          );
          return NextResponse.json({ success: true, data: { password } });
        } catch (e: unknown) {
          return NextResponse.json(
            { success: false, error: e instanceof Error ? e.message : 'Não foi possível ler a senha.' },
            { status: 502 },
          );
        }
      }
      case 'phpmyadminSso': {
        try {
          const url = await createPhpMyAdminSsoUrl(owner, database || undefined);
          return NextResponse.json({ success: true, data: { url } });
        } catch (e: unknown) {
          return NextResponse.json(
            { success: false, error: e instanceof Error ? e.message : 'Não foi possível abrir o MySQL.' },
            { status: 502 },
          );
        }
      }
      case 'check':
      case 'repair':
      case 'optimize': {
        if (!database) return NextResponse.json({ success: false, error: 'Base de dados em falta.' }, { status: 400 });
        const result = await hestiaAdapter.maintainDatabase(database, action);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true, data: result.data });
      }
      case 'grantAccess': {
        const dbuser = String(body.dbuser || body.dbUser || '');
        if (!database || !dbuser) {
          return NextResponse.json({ success: false, error: 'Base de dados e utilizador são obrigatórios.' }, { status: 400 });
        }
        try {
          await hestiaMysql.grantDatabaseAccess(owner, dbuser, database);
          return NextResponse.json({ success: true });
        } catch (e: unknown) {
          return NextResponse.json(
            { success: false, error: e instanceof Error ? e.message : 'Não foi possível conceder acesso.' },
            { status: 502 },
          );
        }
      }
      case 'revokeAccess': {
        const dbuser = String(body.dbuser || body.dbUser || '');
        if (!database || !dbuser) {
          return NextResponse.json({ success: false, error: 'Base de dados e utilizador são obrigatórios.' }, { status: 400 });
        }
        try {
          await hestiaMysql.revokeDatabaseAccess(owner, dbuser, database);
          return NextResponse.json({ success: true });
        } catch (e: unknown) {
          return NextResponse.json(
            { success: false, error: e instanceof Error ? e.message : 'Não foi possível revogar o acesso.' },
            { status: 502 },
          );
        }
      }
      case 'changePrivs': {
        const dbuser = String(body.dbuser || body.dbUser || '');
        const privileges = (body.privileges || {}) as Record<string, boolean>;
        if (!database || !dbuser) {
          return NextResponse.json({ success: false, error: 'Base de dados e utilizador são obrigatórios.' }, { status: 400 });
        }
        try {
          await hestiaMysql.changeDatabasePrivileges(owner, dbuser, database, privileges);
          return NextResponse.json({ success: true });
        } catch (e: unknown) {
          return NextResponse.json(
            { success: false, error: e instanceof Error ? e.message : 'Não foi possível actualizar os privilégios.' },
            { status: 502 },
          );
        }
      }
      case 'changeHosts': {
        const dbuser = String(body.dbuser || body.dbUser || '');
        const hostPatterns = Array.isArray(body.hostPatterns) ? body.hostPatterns.map(String) : [];
        if (!dbuser) return NextResponse.json({ success: false, error: 'Utilizador em falta.' }, { status: 400 });
        try {
          await hestiaMysql.changeMysqlUserHosts(owner, dbuser, hostPatterns);
          return NextResponse.json({ success: true });
        } catch (e: unknown) {
          return NextResponse.json(
            { success: false, error: e instanceof Error ? e.message : 'Não foi possível actualizar os hosts.' },
            { status: 502 },
          );
        }
      }
      case 'fixDefiners':
        return NextResponse.json({ success: false, error: hestiaUnsupported }, { status: 400 });
      default:
        return NextResponse.json(
          { success: false, error: `Acção "${action}" ainda não está disponível para contas Hestia.` },
          { status: 400 },
        );
    }
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Erro interno.' },
      { status: 500 },
    );
  }
}
