/**
 * Quem compra só um domínio (sem alojamento nem e-mail) entra no painel com um painel só do domínio (Silva,
 * 17/10/2026: "Quem compra só um domínio entra sim no painel, mas no painel onde tem somente dados do seu domínio").
 *
 * Hestia (Contabo): cria a conta no pacote VD-Dominio (sem sites, sem e-mail, sem bases de dados) com a zona DNS de
 * cada domínio — é a zona que põe o domínio na lista do painel (vhost-dados.ts, `soDominio`). O DNS público continua na
 * Cloudflare (domain-purchase-provision.ts): a página do domínio lê-o de lá. O que o cliente vê no painel é fixo para
 * este pacote (fixoNoPlano em components/vhost/state.ts): Domínios, DNS, compras e suporte.
 * Ao comprar alojamento ou e-mail mais tarde, o administrador (Admin › Contas › Mudar pacote) ou a compra passa a conta
 * para esse plano e ela ganha os recursos dele.
 * DirectAdmin (Hetzner): nada (fora do projecto).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateProvisionerPassword } from '@/lib/reseller-auto-provision';
import { upsertMirrorSite, upsertMirrorUser } from '@/lib/panel-mirror-write';
import { pickAvailableMirrorUsername } from '@/lib/email-plan-provision';

export const PACOTE_SO_DOMINIO = 'VD-Dominio';
const NOME_DO_PLANO = 'Só domínio';

export async function provisionDomainOnlyAccount(
  admin: SupabaseClient,
  userId: string,
  dominios: string[],
  clientEmail: string,
  displayName?: string | null,
): Promise<{ ok: true; username: string | null } | { ok: false; error: string }> {
  if ((process.env.DEFAULT_HOSTING_PROVIDER || '').trim().toLowerCase() !== 'hestia') return { ok: true, username: null };
  const hestia = await import('@/lib/hestia-adapter');
  const { getProfileForAuthUser, saveProfileForAuthUser } = await import('@/lib/profile-db');
  const profile = await getProfileForAuthUser(admin, userId, clientEmail);
  const contaAtual = String(profile?.da_username || '').trim().toLowerCase();
  const contas = await hestia.listUsers();

  let username: string;
  if (contaAtual && contas.some((u) => u.username === contaAtual)) {
    // já tem conta no servidor: só a do plano "só domínio" recebe os domínios novos; as outras (alojamento, e-mail)
    // gerem os domínios pelo próprio plano
    if (contas.find((u) => u.username === contaAtual)?.packageName !== PACOTE_SO_DOMINIO) return { ok: true, username: null };
    username = contaAtual;
  } else {
    const taken = new Set(contas.map((u) => u.username.toLowerCase()));
    taken.add((process.env.HESTIA_USER || 'vdadmin').trim().toLowerCase());
    username = await pickAvailableMirrorUsername(dominios[0].split('.')[0] || clientEmail.split('@')[0], taken);
    const password = generateProvisionerPassword();
    const criada = await hestia.createUserOnly({ username, password, email: clientEmail, packageName: PACOTE_SO_DOMINIO });
    if (!criada.ok) return { ok: false, error: criada.error || 'Falha ao criar a conta no servidor.' };
    const { encryptDaSecret } = await import('@/lib/da-credential-store');
    await saveProfileForAuthUser(admin, userId, {
      email: clientEmail,
      da_username: username,
      da_password_encrypted: encryptDaSecret(password),
    });
    await upsertMirrorUser({
      username,
      email: clientEmail,
      first_name: displayName || clientEmail.split('@')[0],
      acl: 'user',
      auth_user_id: userId,
      package_name: NOME_DO_PLANO,
      hosting_provider: 'hestia',
    });
  }

  const falhas: string[] = [];
  for (const d of dominios) {
    const zona = await hestia.addDnsZone(username, d);
    if (!zona.ok) falhas.push(`${d}: ${zona.error || 'zona DNS não criada'}`);
    else await upsertMirrorSite({ domain: d, owner: username, admin_email: clientEmail, package: NOME_DO_PLANO });
  }
  if (falhas.length) return { ok: false, error: `conta ${username}: ${falhas.join(' | ')}` };
  return { ok: true, username };
}
