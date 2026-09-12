import { NextRequest, NextResponse } from 'next/server';
import { daAddDnsRecord, daDeleteDnsRecord, normalizeDnsNameForDa } from '@/lib/da-dns-ops';
import {
  loadResellerCredentialsByDaUsername,
  loadResellerCredentialsByUserId,
} from '@/lib/da-credential-store';
import { scheduleDaSync } from '@/lib/da-sync-engine';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { requireDaAccessForDomain } from '@/lib/panel-domain-access';
import type { PanelStaffAuthSuccess } from '@/lib/panel-api-auth';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import { getMirrorSiteOwner, isMirrorStale, listMirrorDns } from '@/lib/panel-mirror-read';
import { deleteMirrorDnsById, upsertMirrorDns } from '@/lib/panel-mirror-write';
import { resolveDirectAdminCredentials, resolveDirectAdminCredentialsForDomainOwner } from '@/lib/directadmin-credentials';
import {
  deleteCloudflareDnsRecord,
  findCloudflareZoneId,
  listCloudflareDnsRecords,
  upsertCloudflareRecord,
} from '@/lib/cloudflare-dns';

async function canAccessDomain(
  role: 'admin' | 'reseller' | 'manager',
  userId: string,
  domain: string,
  impersonatingDaUsername?: string | null,
): Promise<boolean> {
  if (impersonatingDaUsername) {
    const owner = await getMirrorSiteOwner(domain);
    return owner === impersonatingDaUsername;
  }
  if (role === 'admin') return true;
  const creds = await loadResellerCredentialsByUserId(userId);
  if (!creds?.user) return false;
  const owner = await getMirrorSiteOwner(domain);
  return owner === creds.user;
}

async function resolveDaCreds(
  role: 'admin' | 'reseller' | 'manager',
  userId: string,
  impersonatingDaUsername?: string | null,
) {
  if (impersonatingDaUsername) {
    const stored = await loadResellerCredentialsByDaUsername(impersonatingDaUsername);
    if (!stored) throw new Error('Credenciais de revendedor indisponíveis');
    return { role: 'reseller' as const, user: stored.user, password: stored.password };
  }
  if (role === 'admin') return resolveDirectAdminCredentials('admin');
  const stored = await loadResellerCredentialsByUserId(userId);
  if (!stored) throw new Error('Credenciais de revendedor indisponíveis');
  return { role: 'reseller' as const, user: stored.user, password: stored.password };
}

export async function GET(req: NextRequest) {
  try {
    const domain = new URL(req.url).searchParams.get('domain')?.trim();
    if (!domain) {
      return NextResponse.json({ success: false, error: 'Domínio obrigatório' }, { status: 400 });
    }

    // Cliente 'dono' do domínio (verificado contra o mirror) pode ver/editar a
    // sua própria zona DNS; staff (admin/reseller/manager) continua igual.
    const auth = await requireDaAccessForDomain(domain);
    if ('error' in auth) return auth.error;

    let mirrorScope: Awaited<ReturnType<typeof resolvePanelDaContext>>['mirrorScope'];
    let daApi: Awaited<ReturnType<typeof resolvePanelDaContext>>['daApi'];

    if (auth.user.role === 'client') {
      const { getDirectAdminAPIForAuth } = await import('@/lib/directadmin-adapter');
      daApi = await getDirectAdminAPIForAuth({ id: auth.user.id, email: auth.user.email, role: 'admin' });
      mirrorScope = { role: 'admin', userId: auth.user.id };
    } else {
      const ctx = await resolvePanelDaContext(auth as PanelStaffAuthSuccess);
      if (!(await canAccessDomain(auth.user.role, auth.user.id, domain, ctx.impersonating))) {
        return NextResponse.json({ success: false, error: 'Sem acesso a este domínio' }, { status: 403 });
      }
      mirrorScope = ctx.mirrorScope;
      daApi = ctx.daApi;
    }

    const stale = await isMirrorStale(120);
    if (stale) scheduleDaSync(0);

    let records = await listMirrorDns(domain, mirrorScope);
    let source: 'mirror' | 'live' | 'cloudflare' = 'mirror';

    // Domínios com zona própria na Cloudflare (a maioria dos registados pela
    // Dynadot) — a Cloudflare é a fonte autoritativa, não o espelho do DA.
    const cfZoneId = await findCloudflareZoneId(domain);
    if (cfZoneId) {
      const live = await listCloudflareDnsRecords(cfZoneId, domain);
      records = live.map((r) => ({
        id: r.id,
        name: r.name === '@' ? domain : r.name,
        type: r.type,
        content: r.content,
        ttl: r.ttl || 3600,
      }));
      source = 'cloudflare';
    } else if (records.length === 0) {
      try {
        const live = await daApi.listDNS(domain);
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
    const body = await req.json();
    const domain = String(body.domainName || body.domain || '').trim();
    const name = String(body.name || '').trim();
    const type = String(body.type || 'A').toUpperCase();
    const value = String(body.value || body.content || '').trim();
    const ttl = parseInt(String(body.ttl || '3600'), 10) || 3600;

    if (!domain || !name || !type || !value) {
      return NextResponse.json({ success: false, error: 'Campos incompletos' }, { status: 400 });
    }

    const auth = await requireDaAccessForDomain(domain);
    if ('error' in auth) return auth.error;

    let impersonating: string | null | undefined;
    if (auth.user.role !== 'client') {
      const ctx = await resolvePanelDaContext(auth as PanelStaffAuthSuccess);
      impersonating = ctx.impersonating;
      if (!(await canAccessDomain(auth.user.role, auth.user.id, domain, impersonating))) {
        return NextResponse.json({ success: false, error: 'Sem acesso a este domínio' }, { status: 403 });
      }
    }

    // Verifica a Cloudflare ANTES de resolver credenciais do DirectAdmin —
    // um domínio só-Cloudflare (sem conta de hospedagem DA associada) faria
    // resolveDirectAdminCredentialsForDomainOwner rebentar antes de sequer
    // chegarmos aqui, se a ordem fosse a inversa.
    const cfZoneId = await findCloudflareZoneId(domain);
    if (cfZoneId) {
      const result = await upsertCloudflareRecord(cfZoneId, domain, {
        type: type as 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX',
        name,
        content: value,
        ttl,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error || 'Falha ao criar registo na Cloudflare' }, { status: 502 });
      }
      const mirror = await upsertMirrorDns({ domain, name: name === '@' ? domain : name, type, value, ttl });
      return NextResponse.json({
        success: true,
        message: 'Registo DNS criado na Cloudflare.',
        id: mirror.id,
      });
    }

    const creds =
      auth.user.role === 'client'
        ? await resolveDirectAdminCredentialsForDomainOwner(domain)
        : await resolveDaCreds(auth.user.role, auth.user.id, impersonating);

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
    const body = await req.json();
    const domain = String(body.domainName || body.domain || '').trim();
    const id = String(body.id || '').trim();

    if (!domain || !id) {
      return NextResponse.json({ success: false, error: 'Domínio e registo obrigatórios' }, { status: 400 });
    }

    const auth = await requireDaAccessForDomain(domain);
    if ('error' in auth) return auth.error;

    let impersonating: string | null | undefined;
    if (auth.user.role !== 'client') {
      const ctx = await resolvePanelDaContext(auth as PanelStaffAuthSuccess);
      impersonating = ctx.impersonating;
      if (!(await canAccessDomain(auth.user.role, auth.user.id, domain, impersonating))) {
        return NextResponse.json({ success: false, error: 'Sem acesso a este domínio' }, { status: 403 });
      }
    }

    // Cloudflare é autoritativa para este domínio — apaga directamente lá
    // (o id já vem do GET, que agora devolve o id real da Cloudflare para
    // estes domínios), sem passar pelo espelho/credenciais do DirectAdmin.
    const cfZoneId = await findCloudflareZoneId(domain);
    if (cfZoneId) {
      if (!/^[a-f0-9]{32}$/i.test(id)) {
        return NextResponse.json({ success: false, error: 'Id de registo inválido' }, { status: 400 });
      }
      const cfDel = await deleteCloudflareDnsRecord(cfZoneId, id);
      if (!cfDel.ok) {
        return NextResponse.json({ success: false, error: cfDel.error || 'Falha ao remover na Cloudflare' }, { status: 502 });
      }
      await deleteMirrorDnsById(id).catch(() => {});
      return NextResponse.json({ success: true, message: 'Registo DNS removido na Cloudflare.' });
    }

    const creds =
      auth.user.role === 'client'
        ? await resolveDirectAdminCredentialsForDomainOwner(domain)
        : await resolveDaCreds(auth.user.role, auth.user.id, impersonating);

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
