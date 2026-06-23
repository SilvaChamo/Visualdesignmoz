import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { listMirrorWebsites } from '@/lib/panel-mirror-read';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import {
  daBackupCreate,
  daBackupDelete,
  daBackupListFiles,
  daBackupReadFile,
  daBackupRestore,
  daBackupViewItems,
  waitForBackupFileChange,
} from '@/lib/da-backup-api';
import {
  deleteBucketBackup,
  readBucketBackup,
  uploadBackupFileToBucket,
} from '@/lib/panel-backup-bucket';
import {
  deleteBackupMirror,
  listBackupsForOwner,
  upsertBackupMirror,
} from '@/lib/panel-backup-mirror';
import { ensureBackupSchema } from '@/lib/panel-backup-schema';
import type { BackupItemId, BackupTab } from '@/lib/da-backup-types';
import type { PanelAuthSuccess } from '@/lib/panel-api-auth';

export const dynamic = 'force-dynamic';

async function resolveOwnerForDomain(domain: string, auth?: PanelAuthSuccess): Promise<string | null> {
  if (!domain) return null;
  const session = auth ?? await requireAdminOrReseller();
  if ('error' in session) return null;
  const { mirrorScope } = await resolvePanelDaContext(session);
  const sites = await listMirrorWebsites(mirrorScope);
  return sites.find((s) => s.domain === domain)?.owner?.toLowerCase() || null;
}

function backupDownloadResponse(filename: string, base64: string): NextResponse {
  const bytes = Buffer.from(base64, 'base64');
  const isSql = /\.sql$/i.test(filename);
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': isSql ? 'application/sql' : 'application/gzip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

async function resolveBackupDownload(
  owner: string,
  file: string,
  bucketPath: string,
): Promise<NextResponse> {
  if (!file && !bucketPath) {
    return NextResponse.json({ success: false, error: 'Ficheiro em falta.' }, { status: 400 });
  }
  if (bucketPath) {
    const result = await readBucketBackup(bucketPath);
    if (!result.ok || !result.base64) {
      return NextResponse.json({ success: false, error: result.error || 'Download falhou.' }, { status: 502 });
    }
    const name = file || bucketPath.split('/').pop() || 'backup.tar.gz';
    return backupDownloadResponse(name, result.base64);
  }
  const result = await daBackupReadFile(owner, file);
  if (!result.ok || !result.base64) {
    return NextResponse.json({ success: false, error: result.error || 'Download falhou.' }, { status: 502 });
  }
  return backupDownloadResponse(file, result.base64);
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  const sp = req.nextUrl.searchParams;
  const action = sp.get('action');
  const domain = sp.get('domain') || '';
  const owner = await resolveOwnerForDomain(domain, auth);
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Conta de hospedagem não encontrada.' }, { status: 400 });
  }

  if (action === 'download') {
    const file = sp.get('file') || '';
    const bucketPath = sp.get('bucketPath') || '';
    return resolveBackupDownload(owner, file, bucketPath);
  }

  return NextResponse.json({ success: false, error: 'Acção inválida.' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const action = String(body.action || '');
  const domain = String(body.domain || '');
  const batchDomains = Array.isArray(body.domains) ? body.domains.map(String).filter(Boolean) : [];
  const lookupDomain = domain || batchDomains[0] || '';
  const owner = await resolveOwnerForDomain(lookupDomain, auth);
  if (!owner) {
    return NextResponse.json({ success: false, error: 'Conta de hospedagem não encontrada.' }, { status: 400 });
  }

  await ensureBackupSchema();

  try {
    switch (action) {
      case 'list': {
        const scope = body.scope ? String(body.scope) as BackupTab : undefined;
        const listDomain = domain || lookupDomain;
        const accountDomains = Array.isArray(body.accountDomains)
          ? body.accountDomains.map(String).filter(Boolean)
          : [];
        const rows = await listBackupsForOwner(owner, listDomain, scope, accountDomains);
        return NextResponse.json({ success: true, data: rows });
      }
      case 'create': {
        const items = Array.isArray(body.items) ? body.items.map(String) as BackupItemId[] : [];
        if (!items.length || !domain) {
          return NextResponse.json({ success: false, error: 'Seleccione pelo menos um item.' }, { status: 400 });
        }
        const domainOwner = await resolveOwnerForDomain(domain, auth);
        if (!domainOwner) {
          return NextResponse.json({ success: false, error: 'Domínio não encontrado.' }, { status: 400 });
        }
        const result = await daBackupCreate(domainOwner, domain, items);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true });
      }
      case 'create-batch': {
        const items = Array.isArray(body.items) ? body.items.map(String) as BackupItemId[] : [];
        const domains = batchDomains;
        const scope = (String(body.scope || 'full') as BackupTab);
        if (!items.length || !domains.length) {
          return NextResponse.json({ success: false, error: 'Domínios ou itens em falta.' }, { status: 400 });
        }
        const daErrors: string[] = [];
        const warnings: string[] = [];
        const created: string[] = [];
        for (const d of domains) {
          const o = await resolveOwnerForDomain(d, auth);
          if (!o) {
            daErrors.push(`${d}: conta não encontrada`);
            continue;
          }
          const before = await daBackupListFiles(o, d);
          const result = await daBackupCreate(o, d, items);
          if (!result.ok) {
            daErrors.push(`${d}: ${result.error || 'falhou'}`);
            continue;
          }
          let filename = result.filename;
          if (!filename) {
            filename = await waitForBackupFileChange(o, d, before);
          }
          if (filename) created.push(filename);
          else if (result.queued) {
            warnings.push(`${d}: backup em fila no servidor — actualize a lista dentro de instantes`);
          }
          if (filename) {
            const afterList = await daBackupListFiles(o, d);
            const fileRow = afterList.find((f) => f.filename === filename)
              || afterList.sort((a, b) => b.filename.localeCompare(a.filename))[0];
            let bucketPath: string | undefined;
            const uploaded = await uploadBackupFileToBucket(o, d, scope, filename);
            if (!uploaded.ok) {
              warnings.push(`${d}: cópia remota indisponível (${uploaded.error || 'balde'})`);
            } else {
              bucketPath = uploaded.path;
            }
            try {
              await upsertBackupMirror({
                owner: o,
                domain: d,
                filename,
                scope,
                sizeBytes: fileRow?.sizeBytes,
                sizeLabel: fileRow?.size,
                source: bucketPath ? 'both' : 'server',
                serverPath: fileRow?.path,
                bucketPath,
              });
            } catch (mirrorErr: unknown) {
              warnings.push(`${d}: registo no painel indisponível`);
            }
          }
        }
        if (daErrors.length === domains.length) {
          return NextResponse.json({ success: false, error: daErrors.join('; ') }, { status: 502 });
        }
        return NextResponse.json({
          success: true,
          data: {
            warnings: warnings.length ? warnings : undefined,
            created,
          },
        });
      }
      case 'view': {
        const file = String(body.file || '');
        if (!file) return NextResponse.json({ success: false, error: 'Ficheiro em falta.' }, { status: 400 });
        const viewDomain = domain || lookupDomain;
        const viewOwner = await resolveOwnerForDomain(viewDomain, auth) || owner;
        const result = await daBackupViewItems(viewOwner, viewDomain, file);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true, data: { items: result.items || [] } });
      }
      case 'restore': {
        const file = String(body.file || '');
        const items = Array.isArray(body.items) ? body.items.map(String) as BackupItemId[] : [];
        if (!file || !items.length || !domain) {
          return NextResponse.json({ success: false, error: 'Dados de restauro inválidos.' }, { status: 400 });
        }
        const restoreOwner = await resolveOwnerForDomain(domain, auth) || owner;
        const result = await daBackupRestore(restoreOwner, domain, file, items);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
        return NextResponse.json({ success: true });
      }
      case 'delete': {
        const file = String(body.file || '');
        const bucketPath = String(body.bucketPath || '');
        if (!file && !bucketPath) {
          return NextResponse.json({ success: false, error: 'Ficheiro em falta.' }, { status: 400 });
        }
        if (bucketPath) {
          const bucketResult = await deleteBucketBackup(bucketPath);
          if (!bucketResult.ok) {
            return NextResponse.json({ success: false, error: bucketResult.error }, { status: 502 });
          }
        }
        if (file) {
          const deleteOwner = domain ? (await resolveOwnerForDomain(domain, auth) || owner) : owner;
          const deleteDomain = domain || lookupDomain;
          const result = await daBackupDelete(deleteOwner, file);
          if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
          try {
            await deleteBackupMirror(deleteOwner, deleteDomain, file);
          } catch {
            /* espelho opcional */
          }
        }
        return NextResponse.json({ success: true });
      }
      case 'download': {
        const file = String(body.file || '');
        const bucketPath = String(body.bucketPath || '');
        return resolveBackupDownload(owner, file, bucketPath);
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
