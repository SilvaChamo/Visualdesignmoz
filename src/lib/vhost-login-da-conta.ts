/**
 * Login do site para uma conta de alojamento que ainda não o tem (Silva, 17/10/2026: a conta mltmark "não tem email…
 * so tem nome e não consigo entrar"). As contas que vieram do servidor sem compra no site não têm utilizador do site
 * (Supabase Auth): "Mudar senhas" mudava a palavra-passe no servidor, mas não havia login onde a pôr, e a entrada pelo
 * nome da conta falhava sempre.
 *
 * Cria o utilizador do site com a palavra-passe dada e liga-o à conta (perfil com da_username e registo do painel).
 * O e-mail de entrada é `admin@<domínio principal da conta>` (Silva: "cria com email admin") ou, se esse já for de
 * outra pessoa do site, o de contacto da conta no servidor. Nunca liga a conta a um utilizador do site
 * que já exista: isso daria a conta a outra pessoa.
 * Só se chama quando a palavra-passe já foi confirmada no servidor (entrada) ou mudada pelo administrador.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const EMAIL_OK = /^[^\s@,;:"'<>()]+@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export async function criarLoginDaConta(
  sb: SupabaseClient,
  conta: string,
  senha: string,
): Promise<{ ok: true; uid: string; email: string } | { ok: false; erro: string }> {
  const hestia = await import('@/lib/hestia-adapter');
  const { hestiaCallJson } = await import('@/lib/hestia-client');
  const lido = await hestiaCallJson<Record<string, Record<string, string>>>('v-list-user', [conta]);
  if (!lido.ok) return { ok: false, erro: 'A conta não foi encontrada no servidor.' };
  const info = lido.data[conta] || Object.values(lido.data)[0] || {};
  if ((info.ROLE || '').toLowerCase() === 'admin') return { ok: false, erro: 'Contas de administrador do servidor não recebem login do site por aqui.' };

  const sites = await hestia.listWebDomains(conta).catch(() => []);
  const mails = await hestia.listMailDomains(conta).catch(() => [] as string[]);
  const dominio = (sites[0]?.domain || mails[0] || '').toLowerCase();
  // primeiro admin@<domínio> (Silva, 17/10/2026: "cria com email admin"); o de contacto só se esse já for de outra pessoa
  const candidatos = [dominio ? `admin@${dominio}` : '', String(info.CONTACT || '').trim().toLowerCase()]
    .filter((e, i, l) => e && EMAIL_OK.test(e) && l.indexOf(e) === i);
  if (!candidatos.length) return { ok: false, erro: 'A conta não tem e-mail de contacto nem domínio para criar o login.' };

  const nome = [info.FNAME, info.LNAME].filter(Boolean).join(' ').trim() || info.NAME || conta;
  for (const email of candidatos) {
    // já é login de outra pessoa do site: não se usa
    const { data: jaHa } = await sb.from('profiles').select('user_id').ilike('email', email).limit(1);
    if (jaHa && jaHa.length) continue;
    const { data, error } = await sb.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome, role: 'client' } });
    if (error || !data?.user) {
      if (/already|registered|exists/i.test(error?.message || '')) continue;
      return { ok: false, erro: 'Não foi possível criar o login do site: ' + (error?.message || 'erro') };
    }
    const uid = data.user.id;
    const { encryptDaSecret } = await import('@/lib/da-credential-store');
    const enc = encryptDaSecret(senha);
    const { saveProfileForAuthUser } = await import('@/lib/profile-db');
    await saveProfileForAuthUser(sb, uid, { email, name: nome, role: 'client', da_username: conta, da_password_encrypted: enc, da_domain: dominio || null });
    const { upsertMirrorUser } = await import('@/lib/panel-mirror-write');
    await upsertMirrorUser({ username: conta, email, first_name: nome, acl: 'user', auth_user_id: uid, hosting_provider: 'hestia' }).catch(() => {});
    await sb.from('panel_users').update({ auth_user_id: uid, email, da_password_encrypted: enc }).eq('username', conta);
    return { ok: true, uid, email };
  }
  return { ok: false, erro: 'Os e-mails possíveis para esta conta já são de outras pessoas do site. Mude o e-mail de contacto da conta e tente outra vez.' };
}
