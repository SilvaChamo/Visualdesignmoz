/**
 * Associa um domínio (próprio do cliente ou comprado na VisualDesign) ao
 * plano de email básico comprado sem domínio — usado tanto pela rota do
 * cliente (/api/client/attach-email-domain) como pelo fulfillment de compra
 * de um domínio novo (checkout-fulfillment.ts liga automaticamente se
 * houver um plano de email pendente).
 *
 * Hestia (Contabo): cria a conta real — utilizador sem sites (pacote
 * EMAIL_PLAN_HESTIA_PACKAGE) + domínio de email — para o cliente criar e gerir
 * as caixas no painel. Antes só ficava no espelho do painel, por isso as caixas
 * nunca podiam existir no servidor.
 * DirectAdmin (Hetzner): continua só no espelho (licença do servidor sem
 * espaço para mais contas).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeDaUsername } from '@/lib/reseller-provision';
import { generateProvisionerPassword } from '@/lib/reseller-auto-provision';
import { upsertMirrorUser, upsertMirrorSite } from '@/lib/panel-mirror-write';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';

export const EMAIL_PLAN_PACKAGE_NAME = 'Email Básico';
/** Pacote no Hestia: 0 sites, 1 domínio de email, 10 caixas, 10 GB (o que /precos/email anuncia). */
export const EMAIL_PLAN_HESTIA_PACKAGE = 'VD-Email-Basico';

/** `taken`: nomes que já existem no servidor (não só no espelho). */
async function pickAvailableMirrorUsername(base: string, taken: Set<string> = new Set()): Promise<string> {
  const sb = getDaSyncAdmin();
  const sanitized = sanitizeDaUsername(base);
  for (const candidate of [sanitized, `${sanitized}1`, `${sanitized}2`, `${sanitized}${Date.now().toString().slice(-4)}`]) {
    if (taken.has(candidate.toLowerCase())) continue;
    if (!sb) return candidate;
    const { data } = await sb.from('panel_users').select('username').eq('username', candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${sanitized}${Date.now().toString().slice(-6)}`;
}

function newAccountProvider(): 'directadmin' | 'hestia' {
  return (process.env.DEFAULT_HOSTING_PROVIDER || '').trim().toLowerCase() === 'hestia' ? 'hestia' : 'directadmin';
}

/** Cria no Hestia o utilizador (sem sites) e o domínio de email. */
async function provisionEmailPlanOnHestia(
  username: string,
  domain: string,
  clientEmail: string,
): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const hestia = await import('@/lib/hestia-adapter');
  const password = generateProvisionerPassword();
  const created = await hestia.createUserOnly({
    username,
    password,
    email: clientEmail,
    packageName: EMAIL_PLAN_HESTIA_PACKAGE,
  });
  if (!created.ok) return { ok: false, error: created.error || 'Falha ao criar a conta no servidor.' };
  const mail = await hestia.addMailDomain(username, domain);
  if (!mail.ok) return { ok: false, error: mail.error || 'Falha ao activar o email do domínio.' };
  const { invalidateHestiaDomainCache } = await import('@/lib/hosting-resolver');
  invalidateHestiaDomainCache();
  return { ok: true, password };
}

export type AttachEmailDomainResult =
  | { ok: true; domain: string }
  | { ok: false; error: string };

/** Encontra o plano de email do cliente que ainda não tem domínio associado. */
async function findPendingEmailPlan(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from('hosting_renewals')
    .select('id, domain_name')
    .eq('user_id', userId)
    .eq('server', 'Mail')
    .eq('status', 'active')
    .eq('domain_name', '')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data as { id: string; domain_name: string } | null;
}

export async function attachDomainToEmailPlan(
  admin: SupabaseClient,
  userId: string,
  rawDomain: string,
  clientEmail: string,
  displayName?: string | null,
): Promise<AttachEmailDomainResult> {
  const domain = rawDomain.toLowerCase().trim();
  if (!domain.includes('.')) return { ok: false, error: 'Domínio inválido.' };

  const pending = await findPendingEmailPlan(admin, userId);
  if (!pending) return { ok: false, error: 'Sem plano de email pendente para este cliente.' };

  // "não pode ter nenhum domínio adicional" — só um domínio por plano.
  const { data: alreadyAttached } = await admin
    .from('hosting_renewals')
    .select('id')
    .eq('user_id', userId)
    .eq('server', 'Mail')
    .neq('domain_name', '')
    .limit(1)
    .maybeSingle();
  if (alreadyAttached?.id) {
    return { ok: false, error: 'Já tem um domínio associado ao seu plano de email.' };
  }

  const { data: existingSite } = await admin.from('panel_sites').select('domain').eq('domain', domain).maybeSingle();
  if (existingSite) {
    return { ok: false, error: 'Este domínio já está registado no painel.' };
  }

  const provider = newAccountProvider();

  // createUserOnly também diz "ok" quando o utilizador JÁ existe — por isso o
  // nome tem de estar livre no próprio Hestia, senão o domínio do cliente ia
  // parar à conta de outra pessoa.
  let taken = new Set<string>();
  if (provider === 'hestia') {
    const { listUsers } = await import('@/lib/hestia-adapter');
    taken = new Set((await listUsers()).map((u) => u.username.toLowerCase()));
    taken.add((process.env.HESTIA_USER || 'vdadmin').trim().toLowerCase());
  }
  const username = await pickAvailableMirrorUsername(domain.split('.')[0] || clientEmail.split('@')[0], taken);

  if (provider === 'hestia') {
    const provisioned = await provisionEmailPlanOnHestia(username, domain, clientEmail);
    if (!provisioned.ok) {
      const { alertAdminOfTrackingFailure } = await import('@/lib/checkout-fulfillment');
      await alertAdminOfTrackingFailure('plano de email', `${domain} (${username}): ${provisioned.error}`);
      return { ok: false, error: 'Não foi possível activar o email deste domínio no servidor. A nossa equipa foi avisada.' };
    }
    const { saveProfileForAuthUser } = await import('@/lib/profile-db');
    const { encryptDaSecret } = await import('@/lib/da-credential-store');
    await saveProfileForAuthUser(admin, userId, {
      email: clientEmail,
      da_username: username,
      da_password_encrypted: encryptDaSecret(provisioned.password),
    });
  }

  await upsertMirrorUser({
    username,
    email: clientEmail,
    first_name: displayName || clientEmail.split('@')[0],
    acl: 'user',
    auth_user_id: userId,
    package_name: EMAIL_PLAN_PACKAGE_NAME,
    ...(provider === 'hestia' ? { hosting_provider: 'hestia' as const } : {}),
  });
  await upsertMirrorSite({ domain, owner: username, admin_email: clientEmail, package: EMAIL_PLAN_PACKAGE_NAME });
  // Sem caixa "contacto@" fictícia em email_contas: o cliente cria as caixas
  // reais em "Contas de e-mail" (antes aparecia no webmail uma caixa que não
  // existia no servidor).

  await admin.from('hosting_renewals').update({ domain_name: domain }).eq('id', pending.id);

  return { ok: true, domain };
}
