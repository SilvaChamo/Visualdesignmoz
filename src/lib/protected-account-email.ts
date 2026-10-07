/**
 * Emails que uma conta nova só pode usar se quem a cria já gerir o que esse
 * email representa.
 *
 * O painel confia no email do login em vários sítios: papéis do registo
 * (panel-user-registry), a caixa de correio com o mesmo endereço (email-contas,
 * imap-panel-shared) e o dono de um site pelo admin_email (panel-domain-access).
 * Mas há contas criadas sem provar que o email pertence a quem a cria: o
 * registo público (não confirma o email) e as contas que um revendedor cria.
 * Sem esta verificação, qualquer pessoa registava "qualquer@dominio-do-cliente"
 * e o painel tratava-a como dona das caixas desse domínio.
 */
import { isRegisteredPanelEmail } from '@/lib/panel-user-registry';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';

/** Domínios de email da própria equipa. */
const STAFF_EMAIL_DOMAINS = new Set(['visualdesignmoz.com']);

export const PROTECTED_EMAIL_MESSAGE =
  'Este email pertence a um serviço gerido pela VisualDesign (equipa ou domínio alojado connosco). ' +
  'Por segurança, a conta com este email tem de ser criada pela nossa equipa — fale connosco.';

export const RESELLER_PROTECTED_EMAIL_MESSAGE =
  'Este email pertence à equipa da VisualDesign ou a um domínio alojado noutra conta. ' +
  'Use outro email ou peça-nos para criar esta conta.';

export type ProtectedEmailClaim =
  /** Email da equipa ou de um papel registado: nunca por estas vias. */
  | { kind: 'staff' }
  /** Domínio alojado aqui, ou email de dono de um site. `owners` = contas de alojamento envolvidas. */
  | { kind: 'hosted'; owners: string[] };

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function findProtectedEmailClaim(rawEmail: string): Promise<ProtectedEmailClaim | null> {
  const email = rawEmail.trim().toLowerCase();
  const domain = email.split('@')[1] || '';
  if (!domain) return null;
  if (isRegisteredPanelEmail(email) || STAFF_EMAIL_DOMAINS.has(domain)) return { kind: 'staff' };

  const sb = getDaSyncAdmin();
  if (!sb) throw new Error('Não foi possível validar o email agora. Tente novamente.');

  const [byDomain, byAdminEmail, mailbox] = await Promise.all([
    sb.from('panel_sites').select('owner').ilike('domain', escapeLike(domain)),
    sb.from('panel_sites').select('owner').ilike('admin_email', escapeLike(email)),
    sb.from('email_contas').select('email').ilike('email', `%@${escapeLike(domain)}`).limit(1),
  ]);
  if (byDomain.error || byAdminEmail.error || mailbox.error) {
    throw new Error('Não foi possível validar o email agora. Tente novamente.');
  }

  const owners = new Set(
    [...(byDomain.data || []), ...(byAdminEmail.data || [])]
      .map((r) => String(r.owner || '').trim().toLowerCase())
      .filter(Boolean),
  );
  let hosted = Boolean(byDomain.data?.length || byAdminEmail.data?.length || mailbox.data?.length);

  // Hestia: um domínio acabado de criar no servidor pode ainda não estar no espelho.
  if (!byDomain.data?.length) {
    try {
      const { listHostingDomains } = await import('@/lib/hosting-resolver');
      const live = (await listHostingDomains()).find((s) => s.domain.toLowerCase() === domain);
      if (live) {
        hosted = true;
        if (live.owner) owners.add(live.owner.toLowerCase());
      }
    } catch {
      /* o espelho acima continua a valer */
    }
  }

  return hosted ? { kind: 'hosted', owners: [...owners] } : null;
}

/**
 * Revendedor a criar uma conta: só pode usar um email protegido se todas as
 * contas de alojamento envolvidas forem dele (`isOwnerManaged`).
 */
export function resellerMayUseEmail(
  claim: ProtectedEmailClaim | null,
  isOwnerManaged: (owner: string) => boolean,
): boolean {
  if (!claim) return true;
  if (claim.kind === 'staff') return false;
  return claim.owners.length > 0 && claim.owners.every(isOwnerManaged);
}
