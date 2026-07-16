import { NextRequest, NextResponse } from 'next/server';
import { getAdminDirectAdminAPI, getDirectAdminAPIForAuth } from '@/lib/directadmin-adapter';
import { daAddDnsRecord, daDeleteDnsRecord, normalizeDnsNameForDa } from '@/lib/da-dns-ops';
import { loadResellerCredentialsByUserId } from '@/lib/da-credential-store';
import { scheduleDaSync } from '@/lib/da-sync-engine';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import {
  getMirrorSiteOwner,
  isMirrorStale,
  listMirrorDns,
  type MirrorScope,
} from '@/lib/panel-mirror-read';
import { deleteMirrorDnsById, upsertMirrorDns } from '@/lib/panel-mirror-write';
import { resolveDirectAdminCredentials } from '@/lib/directadmin-credentials';

async function canAccessDomain(
  role: 'admin' | 'reseller',
  userId: string,
  domain: string,
): Promise<boolean> {
  if (role === 'admin') return true;
  const creds = await loadResellerCredentialsByUserId(userId);
  if (!creds?.user) return false;
  const owner = await getMirrorSiteOwner(domain);
  return owner === creds.user;
}

async function resolveDaCreds(role: 'admin' | 'reseller', userId: string) {
  if (role === 'admin') return resolveDirectAdminCredentials('admin');
  const stored = await loadResellerCredentialsByUserId(userId);
  if (!stored) throw new Error('Credenciais de revendedor indisponíveis');
  return { role: 'reseller' as const, user: stored.user, password: stored.password };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminOrReseller();
    if ('error' in auth) return auth.error;

    const domain = new URL(req.url).searchParams.get('domain')?.trim();
    if (!domain) {
      return NextResponse.json({ success: false, error: 'Domínio obrigatório' }, { status: 400 });
    }

    if (!(await canAccessDomain(auth.user.role, auth.user.id, domain))) {
      return NextResponse.json({ success: false, error: 'Sem acesso a este domínio' }, { status: 403 });
    }

    const mirrorScope: MirrorScope = { role: auth.user.role, userId: auth.user.id };
    const stale = await isMirrorStale(120);
    if (stale) scheduleDaSync(0);

    let records = await listMirrorDns(domain, mirrorScope);
    let source: 'mirror' | 'live' = 'mirror';

    if (records.length === 0) {
      try {
        const da =
          auth.user.role === 'admin'
            ? await getAdminDirectAdminAPI()
            : await getDirectAdminAPIForAuth({
                id: auth.user.id,
                email: auth.user.email,
                role: 'reseller',
              });
        const live = await da.listDNS(domain);
        records = live.map((r) => ({
          id: '',
          name: String(r.name || ''),
          type: String(r.type || 'A').toUpperCase(),
          content: String(r.content || r.value || ''),
          ttl: Number(r.ttl) || 3600,
        }));
        source = 'live';
        scheduleDaSync(0);
      } catch {
        /* espelho vazio — devolver lista vazia */
      }
    }

    return NextResponse.json({
      success: true,
      domain,
      records,
      source,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Erro ao carregar DNS' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminOrReseller();
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const domain = String(body.domainName || body.domain || '').trim();
    const name = String(body.name || '').trim();
    const type = String(body.type || 'A').toUpperCase();
    const value = String(body.value || body.content || '').trim();
    const ttl = parseInt(String(body.ttl || '3600'), 10) || 3600;

    if (!domain || !name || !type || !value) {
      return NextResponse.json({ success: false, error: 'Campos incompletos' }, { status: 400 });
    }

    if (!(await canAccessDomain(auth.user.role, auth.user.id, domain))) {
      return NextResponse.json({ success: false, error: 'Sem acesso a este domínio' }, { status: 403 });
    }

    const creds = await resolveDaCreds(auth.user.role, auth.user.id);
    const result = await daAddDnsRecord(creds, { domain, name, type, value, ttl });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error || 'Falha ao criar registo' }, { status: 502 });
    }

    const mirrorName = normalizeDnsNameForDa(name, domain).replace(/\.$/, '');
    const mirror = await upsertMirrorDns({ domain, name: mirrorName, type, value, ttl });
    scheduleDaSync(30);

    return NextResponse.json({
      success: true,
      message: 'Registo DNS criado com sucesso.',
      id: mirror.id,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Erro ao criar registo DNS' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdminOrReseller();
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const domain = String(body.domainName || body.domain || '').trim();
    const id = String(body.id || '').trim();

    if (!domain || !id) {
      return NextResponse.json({ success: false, error: 'Domínio e registo obrigatórios' }, { status: 400 });
    }

    if (!(await canAccessDomain(auth.user.role, auth.user.id, domain))) {
      return NextResponse.json({ success: false, error: 'Sem acesso a este domínio' }, { status: 403 });
    }

    const admin = getDaSyncAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Base de dados indisponível' }, { status: 503 });
    }

    const { data: row, error: fetchErr } = await admin
      .from('panel_dns')
      .select('*')
      .eq('id', id)
      .eq('domain', domain)
      .maybeSingle();

    if (fetchErr || !row) {
      return NextResponse.json({ success: false, error: 'Registo não encontrado' }, { status: 404 });
    }

    const creds = await resolveDaCreds(auth.user.role, auth.user.id);
    const result = await daDeleteDnsRecord(creds, {
      domain,
      name: String(row.name),
      type: String(row.type),
      value: String(row.value),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error || 'Falha ao remover registo' }, { status: 502 });
    }

    await deleteMirrorDnsById(id);
    scheduleDaSync(30);

    return NextResponse.json({ success: true, message: 'Registo DNS removido com sucesso.' });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Erro ao remover registo DNS' },
      { status: 500 },
    );
  }
}
