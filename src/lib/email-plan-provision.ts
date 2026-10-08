/**
 * Associa um domínio (próprio do cliente ou comprado na VisualDesign) ao
 * plano de email básico comprado sem domínio — usado tanto pela rota do
 * cliente (/api/client/attach-email-domain) como pelo fulfillment de compra
 * de um domínio novo (checkout-fulfillment.ts liga automaticamente se
 * houver um plano de email pendente).
 *
 * Hestia (Contabo): cria a conta real — utilizador sem sites (pacote
 * do plano em email-plans.ts) + zona DNS + domínio de email — para o cliente criar e gerir
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
import { emailPlanByProductName, emailPlanProductName, getEmailPlan } from '@/lib/email-plans';


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

/**
 * Conta Hestia vazia deixada por uma tentativa anterior deste mesmo cliente
 * que falhou a meio (o utilizador ficou criado, o domínio de email não): mesmo
 * email de contacto, mesmo pacote do plano, sem sites nem domínios de email, e
 * não reclamada no painel por outro login. Reaproveitá-la evita que cada nova
 * tentativa deixe mais uma conta órfã (concordia, concordia1, …).
 */
async function findLeftoverEmailPlanAccount(
  userId: string,
  clientEmail: string,
  hestiaPackage: string,
): Promise<string | null> {
  const hestia = await import('@/lib/hestia-adapter');
  const email = clientEmail.trim().toLowerCase();
  const candidates = (await hestia.listUsers()).filter(
    (u) => u.email.trim().toLowerCase() === email && u.packageName === hestiaPackage,
  );
  const sb = getDaSyncAdmin();
  for (const u of candidates) {
    const [web, mail] = await Promise.all([
      hestia.listWebDomains(u.username).catch(() => null),
      hestia.listMailDomains(u.username).catch(() => null),
    ]);
    if (!web || !mail || web.length > 0 || mail.length > 0) continue;
    if (sb) {
      const { data } = await sb.from('panel_users').select('auth_user_id').eq('username', u.username).maybeSingle();
      if (data?.auth_user_id && data.auth_user_id !== userId) continue;
    }
    return u.username;
  }
  return null;
}

/**
 * Cria no Hestia o utilizador (sem sites) e o domínio de email. Com
 * `reuseAccount`, a conta já existe (ver findLeftoverEmailPlanAccount) — só
 * lhe dá uma password nova, que o painel passa a guardar.
 */
async function provisionEmailPlanOnHestia(
  username: string,
  domain: string,
  clientEmail: string,
  hestiaPackage: string,
  reuseAccount = false,
): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const hestia = await import('@/lib/hestia-adapter');
  const password = generateProvisionerPassword();
  const created = reuseAccount
    ? await hestia.changePassword(username, password)
    : await hestia.createUserOnly({
        username,
        password,
        email: clientEmail,
        packageName: hestiaPackage,
      });
  if (!created.ok) return { ok: false, error: created.error || 'Falha ao criar a conta no servidor.' };
  // Zona DNS antes do domínio de email: assim o Hestia junta logo à zona os
  // registos de email (MX, SPF, DKIM, DMARC). Só conta quando o cliente
  // apontar os nameservers do domínio para ns3/ns4 — sem isso o email
  // continua a funcionar com o DNS que o domínio já tiver.
  const zone = await hestia.addDnsZone(username, domain);
  if (!zone.ok) console.warn('[email-plan] zona DNS não criada:', domain, zone.error);
  const mail = await addMailDomainVerified(username, domain);
  if (!mail.ok) return { ok: false, error: mail.error };
  return { ok: true, password };
}

/**
 * addMailDomain trata "exists" como sucesso (idempotente) — mas o Hestia diz
 * o mesmo quando o domínio é de OUTRA conta, e aí o email nunca ficava nesta.
 * Só conta como feito se o domínio aparecer mesmo nos domínios de email da conta.
 */
async function addMailDomainVerified(
  username: string,
  domain: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const hestia = await import('@/lib/hestia-adapter');
  const mail = await hestia.addMailDomain(username, domain);
  if (!mail.ok) return { ok: false, error: mail.error || 'Falha ao activar o email do domínio.' };
  const { invalidateHestiaDomainCache } = await import('@/lib/hosting-resolver');
  invalidateHestiaDomainCache();
  const owned = await hestia.listMailDomains(username).catch(() => [] as string[]);
  if (!owned.some((d) => d.toLowerCase() === domain)) {
    return { ok: false, error: `o domínio de email ${domain} não ficou na conta ${username} (já existe noutra conta do servidor?)` };
  }
  return { ok: true };
}

export type AttachEmailDomainResult =
  | { ok: true; domain: string }
  | { ok: false; error: string };

/** Encontra o plano de email do cliente que ainda não tem domínio associado. */
async function findPendingEmailPlan(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from('hosting_renewals')
    .select('id, domain_name, package_name')
    .eq('user_id', userId)
    .eq('server', 'Mail')
    .eq('status', 'active')
    .eq('domain_name', '')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data as { id: string; domain_name: string; package_name: string | null } | null;
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

  // Um domínio por plano: só se liga a um plano ainda sem domínio (quem
  // comprar dois planos liga um domínio a cada um).
  const pending = await findPendingEmailPlan(admin, userId);
  if (!pending) return { ok: false, error: 'Não tem nenhum plano de email à espera de domínio.' };
  // Planos comprados antes de 8 out chamavam-se "Email Básico" (era o único).
  const plan = emailPlanByProductName(pending.package_name) ?? getEmailPlan('email-basico')!;
  const planName = emailPlanProductName(plan);

  // Conta de alojamento que este cliente já tem (ex.: site antigo) — um
  // domínio que já lá esteja é dele; noutra conta qualquer, não.
  const { getProfileForAuthUser, saveProfileForAuthUser } = await import('@/lib/profile-db');
  const profile = await getProfileForAuthUser(admin, userId, clientEmail);
  const ownAccount = String(profile?.da_username || '').trim().toLowerCase() || null;

  // Dono actual do domínio (Contabo: directo do Hestia; Hetzner: espelho).
  const { getMirrorSiteOwner } = await import('@/lib/panel-mirror-read');
  const existingOwner = await getMirrorSiteOwner(domain);
  if (existingOwner && (!ownAccount || existingOwner.toLowerCase() !== ownAccount)) {
    return { ok: false, error: 'Este domínio já está registado no painel noutra conta. Contacte o suporte.' };
  }

  const provider = newAccountProvider();
  const alertFailure = async (who: string, error: string) => {
    const { alertAdminOfTrackingFailure } = await import('@/lib/checkout-fulfillment');
    await alertAdminOfTrackingFailure('plano de email', `${domain} (${who}): ${error}`);
  };

  let username: string;
  if (provider === 'hestia') {
    const { findHestiaDomainOwner } = await import('@/lib/hosting-resolver');
    const serverOwner = await findHestiaDomainOwner(domain).catch(() => null);
    if (serverOwner && serverOwner.toLowerCase() !== ownAccount) {
      await alertFailure(serverOwner, `o cliente ${clientEmail} quis associar o domínio ao plano de email, mas ele já existe no servidor na conta ${serverOwner}`);
      return {
        ok: false,
        error: 'Este domínio já existe no servidor noutra conta. A nossa equipa foi avisada e vai passá-lo para a sua — ou contacte o suporte.',
      };
    }

    if (serverOwner) {
      // Já está na conta deste cliente — só falta activar o email lá.
      username = serverOwner;
      const mail = await addMailDomainVerified(username, domain);
      if (!mail.ok) {
        await alertFailure(username, mail.error);
        return { ok: false, error: 'Não foi possível activar o email deste domínio no servidor. A nossa equipa foi avisada.' };
      }
    } else {
      // createUserOnly também diz "ok" quando o utilizador JÁ existe — por isso o
      // nome tem de estar livre no próprio Hestia, senão o domínio do cliente ia
      // parar à conta de outra pessoa.
      const leftover = await findLeftoverEmailPlanAccount(userId, clientEmail, plan.hestiaPackage).catch(() => null);
      if (leftover) {
        username = leftover;
      } else {
        const { listUsers } = await import('@/lib/hestia-adapter');
        const taken = new Set((await listUsers()).map((u) => u.username.toLowerCase()));
        taken.add((process.env.HESTIA_USER || 'vdadmin').trim().toLowerCase());
        username = await pickAvailableMirrorUsername(domain.split('.')[0] || clientEmail.split('@')[0], taken);
      }

      const provisioned = await provisionEmailPlanOnHestia(username, domain, clientEmail, plan.hestiaPackage, Boolean(leftover));
      if (!provisioned.ok) {
        await alertFailure(username, provisioned.error);
        return { ok: false, error: 'Não foi possível activar o email deste domínio no servidor. A nossa equipa foi avisada.' };
      }
      const { encryptDaSecret } = await import('@/lib/da-credential-store');
      await saveProfileForAuthUser(admin, userId, {
        email: clientEmail,
        da_username: username,
        da_password_encrypted: encryptDaSecret(provisioned.password),
      });
    }
  } else {
    username = await pickAvailableMirrorUsername(domain.split('.')[0] || clientEmail.split('@')[0]);
  }

  await upsertMirrorUser({
    username,
    email: clientEmail,
    first_name: displayName || clientEmail.split('@')[0],
    acl: 'user',
    auth_user_id: userId,
    package_name: planName,
    ...(provider === 'hestia' ? { hosting_provider: 'hestia' as const } : {}),
  });
  await upsertMirrorSite({ domain, owner: username, admin_email: clientEmail, package: planName });
  // Sem caixa "contacto@" fictícia em email_contas: o cliente cria as caixas
  // reais em "Contas de e-mail" (antes aparecia no webmail uma caixa que não
  // existia no servidor).

  await admin.from('hosting_renewals').update({ domain_name: domain }).eq('id', pending.id);

  return { ok: true, domain };
}
