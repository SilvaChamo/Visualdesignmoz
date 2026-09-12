import { NextRequest, NextResponse } from 'next/server';
import { daRequest } from '@/lib/directadmin';
import { requireAdminResellerOrManager, type PanelStaffAuthSuccess } from '@/lib/panel-api-auth';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import { loadResellerCredentialsByDaUsername, resolveOwnerDaUsername } from '@/lib/da-credential-store';
import { resolveDirectAdminCredentials, type DirectAdminCredentials } from '@/lib/directadmin-credentials';
import { resolveHostingOwner, hostingProvider as _hostingProvider } from '@/lib/hosting-resolver';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { encryptStoredPassword } from '@/lib/panel-access-credentials';
import { getProviderByUsername, isHestiaOnlyDeploy } from '@/lib/hosting-provider';
import * as hestiaAdapter from '@/lib/hestia-adapter';

/**
 * GET  ?action=list&domain=visualdesignmoz.com  → lista emails
 * POST action=create  → cria email
 * DELETE action=delete → apaga email
 * PATCH action=password → muda password
 */

async function canAccessDomain(
  role: 'admin' | 'reseller' | 'manager' | 'profissional',
  userId: string,
  domain: string,
  impersonatingDaUsername?: string | null,
): Promise<boolean> {
  if (impersonatingDaUsername) {
    const owner = await resolveHostingOwner(domain);
    return owner === impersonatingDaUsername;
  }
  if (role === 'admin') return true;
  const username = await resolveOwnerDaUsername(userId);
  if (!username) return false;
  const owner = await resolveHostingOwner(domain);
  return owner === username;
}

async function resolveEmailProvider(
  domain: string,
): Promise<{ provider: 'hestia' | 'directadmin'; owner: string | null }> {
  const owner = await resolveHostingOwner(domain);
  if (_hostingProvider === 'hestia') return { provider: 'hestia', owner };
  if (!owner) return { provider: 'directadmin', owner: null };
  return { provider: await getProviderByUsername(owner), owner };
}

/** daRequest só conhece 'admin'|'reseller' — "manager"/"profissional" usam sempre o caminho escopado 'reseller'. */
function toDaRole(role: 'admin' | 'reseller' | 'manager' | 'profissional'): 'admin' | 'reseller' {
  return role === 'admin' ? 'admin' : 'reseller';
}

async function resolveDaRequestCredentials(auth: PanelStaffAuthSuccess): Promise<DirectAdminCredentials> {
  const { impersonating } = await resolvePanelDaContext(auth);
  if (impersonating) {
    const stored = await loadResellerCredentialsByDaUsername(impersonating);
    if (!stored) throw new Error('Credenciais de revendedor indisponíveis');
    return { role: 'reseller', user: stored.user, password: stored.password };
  }
  return resolveDirectAdminCredentials(toDaRole(auth.user.role), {
    id: auth.user.id,
    email: auth.user.email,
    role: toDaRole(auth.user.role),
  });
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminResellerOrManager();
    if ('error' in auth) return auth.error;
    const ctx = auth.user;
    const { impersonating } = await resolvePanelDaContext(auth);

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'list';
    const domain = searchParams.get('domain') || '';

    if (action === 'domains') {
      if (ctx.role !== 'admin' || impersonating) {
        return NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 });
      }

      if (isHestiaOnlyDeploy()) {
        // Este servidor é só Hestia — nunca falar com o DirectAdmin. Lista
        // todos os domínios de todas as contas Hestia, em vez do resumo DA.
        const users = await hestiaAdapter.listUsers();
        const domains: string[] = [];
        for (const u of users) {
          const webDomains = await hestiaAdapter.listWebDomains(u.username).catch(() => []);
          domains.push(...webDomains.map((d) => d.domain));
        }
        return NextResponse.json({ success: true, domains });
      }

      // Listar todos os domínios que têm email no servidor DirectAdmin.
      const creds = await resolveDaRequestCredentials(auth);
      const res = await daRequest('CMD_API_SHOW_ALL_USERS', 'GET', { json: 'yes' }, creds);
      const domainsRes = await daRequest('CMD_API_ADDITIONAL_DOMAINS', 'GET', { domain: 'admin' }, creds);
      return NextResponse.json({ success: true, raw: domainsRes });
    }

    if (action === 'list' && domain) {
      if (!(await canAccessDomain(ctx.role, ctx.id, domain, impersonating))) {
        return NextResponse.json({ success: false, error: 'Domínio fora do seu painel.' }, { status: 403 });
      }

      const { provider, owner } = await resolveEmailProvider(domain);

      if (provider === 'hestia') {
        if (!owner) {
          return NextResponse.json({ success: false, error: 'Dono do domínio não identificado no Hestia.' }, { status: 404 });
        }
        const accounts = await hestiaAdapter.listMailAccounts(owner, domain);
        const emails = accounts.map((a) => ({
          email: `${a.account}@${domain}`,
          quota: a.quotaMb != null ? String(a.quotaMb) : 'N/A',
          usage: String(a.diskUsedMb ?? 0),
        }));
        return NextResponse.json({ success: true, domain, emails });
      }

      const creds = await resolveDaRequestCredentials(auth);
      // CMD_API_POP lista as contas de email para um domínio
      const res = await daRequest('CMD_API_POP', 'GET', { action: 'list', domain }, creds);

      if (res.error) {
        return NextResponse.json({ success: false, error: res.text || 'Erro ao listar emails' });
      }

      // DA devolve: list[]=conta1&list[]=conta2&quota[conta1]=xxx&usage[conta1]=xxx
      const emails: Array<{ email: string; quota: string; usage: string }> = [];
      const rawData = res.data || {};

      // Extrair contas da lista
      const accounts: string[] = [];
      for (const [key, value] of Object.entries(rawData)) {
        if (key.startsWith('list')) {
          accounts.push(value as string);
        }
      }

      for (const account of accounts) {
        emails.push({
          email: `${account}@${domain}`,
          quota: rawData[`quota[${account}]`] as string || rawData[`quota`] as string || 'N/A',
          usage: rawData[`usage[${account}]`] as string || '0',
        });
      }

      return NextResponse.json({ success: true, domain, emails });
    }

    return NextResponse.json({ success: false, error: 'Acção ou domínio em falta' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminResellerOrManager();
    if ('error' in auth) return auth.error;
    const ctx = auth.user;
    const { impersonating } = await resolvePanelDaContext(auth);

    const { action, domain, username, password, quota = '250' } = await req.json();

    if (!domain || !username || !password) {
      return NextResponse.json({ success: false, error: 'domain, username e password são obrigatórios' }, { status: 400 });
    }

    if (!(await canAccessDomain(ctx.role, ctx.id, domain, impersonating))) {
      return NextResponse.json({ success: false, error: 'Domínio fora do seu painel.' }, { status: 403 });
    }

    if (action === 'create') {
      const { provider, owner } = await resolveEmailProvider(domain);

      if (provider === 'hestia') {
        if (!owner) {
          return NextResponse.json({ success: false, error: 'Dono do domínio não identificado no Hestia.' }, { status: 404 });
        }
        const result = await hestiaAdapter.addMailAccount(owner, domain, username, password, Number(quota) || undefined);
        if (!result.ok) {
          return NextResponse.json({ success: false, error: result.error || 'Erro ao criar email' });
        }
        return NextResponse.json({ success: true, message: `Email ${username}@${domain} criado com sucesso!` });
      }

      const creds = await resolveDaRequestCredentials(auth);
      const res = await daRequest(
        'CMD_API_POP',
        'POST',
        { action: 'create', domain, user: username, passwd: password, passwd2: password, quota: String(quota) },
        creds,
      );

      if (res.error) {
        return NextResponse.json({ success: false, error: res.details || res.text || 'Erro ao criar email' });
      }

      return NextResponse.json({
        success: true,
        message: `Email ${username}@${domain} criado com sucesso!`,
      });
    }

    return NextResponse.json({ success: false, error: 'Acção inválida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdminResellerOrManager();
    if ('error' in auth) return auth.error;
    const ctx = auth.user;
    const { impersonating } = await resolvePanelDaContext(auth);

    const { domain, username } = await req.json();

    if (!domain || !username) {
      return NextResponse.json({ success: false, error: 'domain e username são obrigatórios' }, { status: 400 });
    }

    if (!(await canAccessDomain(ctx.role, ctx.id, domain, impersonating))) {
      return NextResponse.json({ success: false, error: 'Domínio fora do seu painel.' }, { status: 403 });
    }

    const { provider, owner } = await resolveEmailProvider(domain);

    if (provider === 'hestia') {
      if (!owner) {
        return NextResponse.json({ success: false, error: 'Dono do domínio não identificado no Hestia.' }, { status: 404 });
      }
      const result = await hestiaAdapter.deleteMailAccount(owner, domain, username);
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error || 'Erro ao apagar email' });
      }
      return NextResponse.json({ success: true, message: `Email ${username}@${domain} apagado.` });
    }

    const creds = await resolveDaRequestCredentials(auth);
    const res = await daRequest('CMD_API_POP', 'POST', { action: 'delete', domain, user: username }, creds);

    if (res.error) {
      return NextResponse.json({ success: false, error: res.details || res.text || 'Erro ao apagar email' });
    }

    return NextResponse.json({ success: true, message: `Email ${username}@${domain} apagado.` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdminResellerOrManager();
    if ('error' in auth) return auth.error;
    const ctx = auth.user;
    const { impersonating } = await resolvePanelDaContext(auth);

    const { domain, username, password } = await req.json();

    if (!domain || !username || !password) {
      return NextResponse.json({ success: false, error: 'domain, username e password são obrigatórios' }, { status: 400 });
    }

    if (!(await canAccessDomain(ctx.role, ctx.id, domain, impersonating))) {
      return NextResponse.json({ success: false, error: 'Domínio fora do seu painel.' }, { status: 403 });
    }

    const { provider, owner } = await resolveEmailProvider(domain);

    if (provider === 'hestia') {
      if (!owner) {
        return NextResponse.json({ success: false, error: 'Dono do domínio não identificado no Hestia.' }, { status: 404 });
      }
      const result = await hestiaAdapter.changeMailAccountPassword(owner, domain, username, password);
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error || 'Erro ao alterar password' });
      }

      const sbHestia = getDaSyncAdmin();
      if (sbHestia) {
        await sbHestia
          .from('email_contas')
          .update({ senha_servidor: encryptStoredPassword(password) })
          .eq('email', `${username}@${domain}`);
      }

      return NextResponse.json({ success: true, message: `Password de ${username}@${domain} alterada.` });
    }

    const creds = await resolveDaRequestCredentials(auth);
    const res = await daRequest(
      'CMD_API_POP',
      'POST',
      { action: 'modify', domain, user: username, passwd: password, passwd2: password },
      creds,
    );

    if (res.error) {
      return NextResponse.json({ success: false, error: res.details || res.text || 'Erro ao alterar password' });
    }

    // Mantém a cópia usada pelo webmail (IMAP) em sincronia com a password
    // real que acabou de ser definida no servidor de correio — sem isto,
    // `email_contas.senha_servidor` fica desactualizada e o login IMAP passa
    // a falhar de forma intermitente consoante o que o browser tem em cache.
    const sb = getDaSyncAdmin();
    if (sb) {
      await sb
        .from('email_contas')
        .update({ senha_servidor: encryptStoredPassword(password) })
        .eq('email', `${username}@${domain}`);
    }

    return NextResponse.json({ success: true, message: `Password de ${username}@${domain} alterada.` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
