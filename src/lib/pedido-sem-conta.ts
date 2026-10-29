import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptDaSecret, encryptDaSecret } from '@/lib/da-credential-store';
import { saveProfileForAuthUser } from '@/lib/profile-db';

/**
 * Compra por M-Pesa/Transferência de quem ainda não tem conta (Silva, 29/10/2026): no «Pagar» não se cria nada — nem login,
 * nem conta no servidor, nem hospedagem. O pedido guarda os dados digitados (`cadastro`, com a palavra-passe cifrada) e uma
 * chave (`token_acesso`) que fica no navegador para enviar o comprovativo. Só o «Confirmar» da equipa cria o login (e a seguir
 * a hospedagem, em fulfillCheckout). Se o pedido for cancelado, não fica nada criado para nada.
 */
export type CadastroPedido = {
  nome: string;
  apelido: string;
  email: string;
  telefone: string;
  morada: string;
  provincia: string;
  empresa: string;
  emailEmpresa?: string;
  cargo?: string;
  /** palavra-passe escolhida, cifrada; apaga-se quando o login é criado */
  senha?: string;
};

export function novoTokenPedido(): string {
  return randomBytes(24).toString('hex');
}

export function cifrarSenhaPedido(senha: string): string {
  return encryptDaSecret(senha);
}

/** A chave enviada pelo navegador é a do pedido? (comparação em tempo constante) */
export function tokenDoPedidoConfere(guardado: unknown, enviado: unknown): boolean {
  const a = Buffer.from(String(guardado || ''));
  const b = Buffer.from(String(enviado || ''));
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export function cadastroDoPedido(row: { cadastro?: unknown } | null | undefined): CadastroPedido | null {
  const c = row?.cadastro as Partial<CadastroPedido> | null | undefined;
  if (!c || typeof c !== 'object' || !String(c.email || '').includes('@')) return null;
  return {
    nome: String(c.nome || ''),
    apelido: String(c.apelido || ''),
    email: String(c.email || '').toLowerCase().trim(),
    telefone: String(c.telefone || ''),
    morada: String(c.morada || ''),
    provincia: String(c.provincia || ''),
    empresa: String(c.empresa || ''),
    emailEmpresa: String(c.emailEmpresa || '').trim(),
    cargo: String(c.cargo || '').trim(),
    senha: c.senha ? String(c.senha) : undefined,
  };
}

/** Para os avisos (e-mail) de um pedido que ainda não tem dono: o e-mail e o nome digitados no checkout. */
export function destinatarioDoPedido(row: { cadastro?: unknown } | null | undefined): { email: string; nome: string } | null {
  const c = cadastroDoPedido(row);
  return c ? { email: c.email, nome: [c.nome, c.apelido].filter(Boolean).join(' ') || c.email.split('@')[0] } : null;
}

async function utilizadorPorEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const achado = data.users.find((u) => u.email?.toLowerCase() === email);
    if (achado) return achado.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

/**
 * Dono do pedido no momento da aprovação. Pedido sem dono: cria agora o login com os dados e a palavra-passe do checkout
 * (ou, se entretanto o e-mail já tiver conta, usa essa), grava o perfil e passa o pedido para essa conta.
 * Devolve o utilizador e se o login foi criado agora (para o e-mail de confirmação dizer como entrar).
 */
export async function donoDoPedidoAoAprovar(
  admin: SupabaseClient,
  session: { id: string; user_id: string | null; cadastro?: unknown },
): Promise<{ userId: string; contaCriada: boolean }> {
  if (session.user_id) return { userId: session.user_id, contaCriada: false };
  const c = cadastroDoPedido(session);
  if (!c) throw new Error('Este pedido não tem os dados da conta a criar.');

  let userId = await utilizadorPorEmail(admin, c.email);
  let contaCriada = false;
  if (!userId) {
    const senha = c.senha ? decryptDaSecret(c.senha) : '';
    if (!senha || senha.length < 6) throw new Error('A palavra-passe guardada neste pedido não é válida; peça ao cliente para refazer a compra.');
    const nome = [c.nome, c.apelido].filter(Boolean).join(' ');
    const { data, error } = await admin.auth.admin.createUser({
      email: c.email,
      password: senha,
      email_confirm: true,
      user_metadata: { role: 'guest', nome, telefone: c.telefone, empresa: c.empresa, email_empresa: c.emailEmpresa || '', cargo: c.cargo || '', endereco: c.morada, provincia: c.provincia, pais: 'Mozambique' },
    });
    if (error || !data.user) throw new Error(error?.message || 'Não foi possível criar a conta do cliente.');
    userId = data.user.id;
    contaCriada = true;
    await saveProfileForAuthUser(admin, userId, {
      email: c.email,
      role: 'guest',
      name: nome || c.email.split('@')[0],
      telefone: c.telefone,
      empresa: c.empresa || undefined,
      morada: c.morada,
      cidade: c.provincia,
    });
  }

  // o pedido passa a ter dono; a palavra-passe cifrada e a chave deixam de ser precisas
  const { senha: _senha, ...semSenha } = c;
  void _senha;
  await admin.from('checkout_sessions').update({ user_id: userId, cadastro: semSenha, token_acesso: null }).eq('id', session.id);
  return { userId, contaCriada };
}
