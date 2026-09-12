import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { directAdminHostingAPI as directAdminAPI } from '@/lib/directadmin-adapter';
import type { DirectAdminWebsite } from '@/lib/directadmin-api';
import * as hestiaAdapter from '@/lib/hestia-adapter';
import { isHestiaOnlyDeploy } from '@/lib/hosting-provider';
import { PANEL_SLUG, inferPanelSiteFromEmail } from '@/lib/panel-tenant';
import { upsertDownloadableCredentials, decryptStoredPassword } from '@/lib/panel-access-credentials';
import { buildPanelAccessConfigText } from '@/lib/panel-access-config-text';
import { requireAdmin } from '@/lib/admin-api-auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
import { getStandardPanelPassword } from '@/lib/stored-panel-password';

type SyncResults = {
  totalDomains: number;
  emailsFound: number;
  usersCreated: number;
  errors: string[];
};

/** Garante que uma caixa de email real (Hestia ou DirectAdmin, tanto faz a
 * origem) tem sempre utilizador Supabase Auth + perfil + credenciais
 * descarregáveis correspondentes — a lógica é a mesma para as duas origens,
 * só muda de onde vem a lista de emails. */
async function syncEmailAccountToSupabase(
  admin: any,
  email: string,
  domain: string,
  results: SyncResults,
): Promise<void> {
  try {
    const { data: users, error: listError } = await admin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = users.users.find((user: any) => user.email?.toLowerCase() === email.toLowerCase());
    let userId = existingUser?.id;
    const existingMetaRole =
      existingUser?.user_metadata?.role || existingUser?.app_metadata?.role;
    const isProtectedRole =
      existingMetaRole === 'admin' || existingMetaRole === 'reseller';

    if (!userId) {
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email,
        password: getStandardPanelPassword(),
        email_confirm: true,
        user_metadata: {
          role: 'client',
          nome: email.split('@')[0],
          domain,
          site: inferPanelSiteFromEmail(email) || PANEL_SLUG,
        },
      });

      if (createError) throw createError;
      userId = newUser.user.id;
      results.usersCreated++;
    }

    const { data: siteData } = await admin
      .from('site_clientes')
      .select('id')
      .eq('dominio', domain)
      .maybeSingle();

    const { getProfileForAuthUser, saveProfileForAuthUser } = await import('@/lib/profile-db');
    const existingProfile = userId ? await getProfileForAuthUser(admin, userId) : null;
    const existingProfileRole = existingProfile?.role;
    const skipRoleDowngrade =
      isProtectedRole ||
      existingProfileRole === 'admin' ||
      existingProfileRole === 'reseller';

    if (!skipRoleDowngrade) {
      await saveProfileForAuthUser(admin, userId!, {
        email,
        name: email.split('@')[0],
        role: 'client',
      });
    }

    await upsertDownloadableCredentials(admin, {
      email,
      password: getStandardPanelPassword(),
      userId: userId!,
      role: 'client',
    });

    if (siteData?.id) {
      await admin
        .from('email_contas')
        .update({ site_id: siteData.id })
        .eq('email', email);
    }
  } catch (error: any) {
    results.errors.push(`${email}: ${error?.message || 'Erro ao sincronizar conta'}`);
  }
}

async function syncFromHestia(admin: any): Promise<SyncResults> {
  const results: SyncResults = { totalDomains: 0, emailsFound: 0, usersCreated: 0, errors: [] };

  const users = await hestiaAdapter.listUsers();
  for (const hestiaUser of users) {
    const webDomains = await hestiaAdapter.listWebDomains(hestiaUser.username).catch((error: any) => {
      results.errors.push(`${hestiaUser.username}: ${error?.message || 'Erro ao listar domínios no Hestia'}`);
      return [];
    });

    for (const webDomain of webDomains) {
      results.totalDomains++;
      const domain = webDomain.domain;
      const emailAccounts = await hestiaAdapter
        .listMailAccounts(hestiaUser.username, domain)
        .catch((error: any) => {
          results.errors.push(`${domain}: ${error?.message || 'Erro ao listar emails no Hestia'}`);
          return [];
        });

      results.emailsFound += emailAccounts.length;
      for (const account of emailAccounts) {
        const email = `${account.account}@${domain}`;
        await syncEmailAccountToSupabase(admin, email, domain, results);
      }
    }
  }

  return results;
}

async function syncFromDirectAdmin(admin: any): Promise<SyncResults> {
  const sites = await directAdminAPI.listWebsites() as DirectAdminWebsite[];
  const domains = Array.from(new Set(sites.map((site: DirectAdminWebsite) => site.domain).filter(Boolean)));

  const results: SyncResults = { totalDomains: domains.length, emailsFound: 0, usersCreated: 0, errors: [] };

  for (const domain of domains) {
    const emailAccounts = await directAdminAPI.listEmails(domain).catch((error: any) => {
      results.errors.push(`${domain}: ${error?.message || 'Erro ao listar emails no DirectAdmin'}`);
      return [];
    });

    results.emailsFound += emailAccounts.length;
    for (const account of emailAccounts) {
      const email = account.email || '';
      if (!email) continue;
      await syncEmailAccountToSupabase(admin, email, domain, results);
    }
  }

  return results;
}

export async function POST() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Supabase Service Role não configurado.' },
        { status: 500 },
      );
    }

    const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    // Este servidor (Contabo) é só Hestia — nunca falar com o DirectAdmin,
    // nem para sincronizar emails.
    const results = isHestiaOnlyDeploy() ? await syncFromHestia(admin) : await syncFromDirectAdmin(admin);

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
