import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { listMirrorUsers } from '@/lib/panel-mirror-read';
import { upsertMirrorSite } from '@/lib/panel-mirror-write';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { getAdminDirectAdminAPI } from '@/lib/directadmin-adapter';
import { getProviderByUsername } from '@/lib/hosting-provider';
import * as hestiaAdapter from '@/lib/hestia-adapter';
import { pointHostingHostToServer, scheduleHostingSslRetry } from '@/lib/hosting-site-dns';
import { HOSTING_DOMAIN_REGEX } from '@/lib/checkout-fulfillment';
import { after } from 'next/server';

/**
 * #20 — associar um domínio a uma conta de hospedagem que já existe (não é
 * o #32, que conclui hospedagens que nunca chegaram a ser criadas). O painel
 * (panel_sites) é a fonte de verdade; DNS e DirectAdmin são melhor-esforço,
 * nunca bloqueiam nem revertem a associação já gravada.
 */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const users = await listMirrorUsers({ role: 'admin' });
    const accounts = users
      .filter((u) => u.userName)
      .map((u) => ({ daUsername: u.userName, email: u.email || '', packageName: u.packageName || '' }))
      .sort((a, b) => a.daUsername.localeCompare(b.daUsername));
    return NextResponse.json({ success: true, accounts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao listar contas';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const { domain, daUsername } = (await req.json()) as { domain?: string; daUsername?: string };
    const domainName = (domain || '').toLowerCase().trim();
    const username = (daUsername || '').trim();
    if (!HOSTING_DOMAIN_REGEX.test(domainName) || !username) {
      return NextResponse.json({ success: false, error: 'domain (válido) e daUsername são obrigatórios.' }, { status: 400 });
    }

    const users = await listMirrorUsers({ role: 'admin' });
    const account = users.find((u) => u.userName === username);
    if (!account) {
      return NextResponse.json({ success: false, error: `Não existe nenhuma conta de hospedagem "${username}".` }, { status: 404 });
    }

    const steps: { step: string; ok: boolean; detail?: string }[] = [];

    // 1) Fonte de verdade — grava já, antes de qualquer coisa que possa falhar.
    const siteResult = await upsertMirrorSite({
      domain: domainName,
      owner: username,
      admin_email: account.email || '',
      package: account.packageName || 'Default',
    });
    if (!siteResult.ok) {
      return NextResponse.json({ success: false, error: siteResult.error || 'Falha ao gravar a associação no painel' }, { status: 500 });
    }
    steps.push({ step: 'Associação gravada no painel', ok: true });

    // 2) DNS — melhor esforço. Subdomínios usam a zona do domínio pai.
    const dns = await pointHostingHostToServer(domainName);
    steps.push({
      step: 'DNS apontado para o servidor (Cloudflare)',
      ok: dns.ok,
      detail: dns.ok ? undefined : dns.error || 'Domínio sem zona na Cloudflare — aponta o DNS manualmente.',
    });

    // 3) Painel de hospedagem (DirectAdmin ou Hestia, consoante a conta) — em
    //    segundo plano, nunca bloqueia nem desfaz os passos acima.
    //    #achado 15 ago: antes disto chamava sempre o DirectAdmin, mesmo para
    //    contas Hestia (Contabo/teste) — o domínio ficava associado no nosso
    //    painel mas nunca era criado a sério no Hestia.
    const provider = await getProviderByUsername(username);
    const daTask = async () => {
      try {
        if (provider === 'hestia') {
          const result = await hestiaAdapter.addWebDomain(username, domainName);
          if (!result.ok) {
            console.error('[attach-hosting] propagação Hestia falhou:', domainName, username, result.error);
          } else {
            scheduleHostingSslRetry(username, domainName);
          }
          return;
        }
        const api = await getAdminDirectAdminAPI();
        const result = await api.createWebsite({ domainName, owner: username, createUserAccount: false });
        if (!result.success) {
          console.error('[attach-hosting] propagação DirectAdmin falhou:', domainName, username, result.error);
        }
      } catch (err) {
        console.error('[attach-hosting] propagação para o painel de hospedagem:', err);
      }
    };
    try {
      after(daTask);
    } catch {
      void daTask();
    }
    steps.push({
      step: `Propagação para o ${provider === 'hestia' ? 'Hestia' : 'DirectAdmin'}`,
      ok: true,
      detail: 'em curso em segundo plano',
    });

    return NextResponse.json({ success: true, steps, message: `${domainName} associado a ${username}.` });
  } catch (error: unknown) {
    console.error('[admin/domains/attach-hosting] POST:', error);
    const message = error instanceof Error ? error.message : 'Erro ao associar domínio';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Desfaz a associação — só o registo no painel; nunca apaga a conta nem os emails. */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const { domain } = (await req.json()) as { domain?: string };
    const domainName = (domain || '').toLowerCase().trim();
    if (!domainName) {
      return NextResponse.json({ success: false, error: 'domain é obrigatório.' }, { status: 400 });
    }
    const sb = getDaSyncAdmin();
    if (!sb) return NextResponse.json({ success: false, error: 'Base de dados indisponível' }, { status: 500 });
    const { error } = await sb.from('panel_sites').delete().eq('domain', domainName);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: `Associação de ${domainName} removida do painel.` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao remover associação';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
