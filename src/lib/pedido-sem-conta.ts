import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptDaSecret, encryptDaSecret } from '@/lib/da-credential-store';
import { saveProfileForAuthUser } from '@/lib/profile-db';
import { temContaReal, utilizadorPorEmail } from '@/lib/conta-existe';

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

/**
 * Dono do pedido no momento da aprovação. Pedido sem dono: cria agora o login com os dados e a palavra-passe do checkout
 * (ou, se entretanto o e-mail já tiver conta, usa essa), grava o perfil e passa o pedido para essa conta.
 * Um login que já existia mas está vazio (sem hospedagem, sem compras: sobra de uma compra a meio) não impede nada: fica com os
 * dados e a palavra-passe desta compra (Silva, 30/10/2026). Uma conta a sério mantém a sua palavra-passe: o mesmo e-mail pode ter
 * várias hospedagens, todas no mesmo login.
 * Devolve o utilizador e se a palavra-passe do checkout passou a ser a do login (para entrar logo e para o e-mail dizer como entrar).
 */
export async function donoDoPedidoAoAprovar(
  admin: SupabaseClient,
  session: { id: string; user_id: string | null; cadastro?: unknown },
): Promise<{ userId: string; contaCriada: boolean; senhaDefinida: boolean }> {
  if (session.user_id) return { userId: session.user_id, contaCriada: false, senhaDefinida: false };
  const c = cadastroDoPedido(session);
  if (!c) throw new Error('Este pedido não tem os dados da conta a criar.');

  const senha = c.senha ? decryptDaSecret(c.senha) : '';
  const nome = [c.nome, c.apelido].filter(Boolean).join(' ');
  const metadados = { nome, telefone: c.telefone, empresa: c.empresa, email_empresa: c.emailEmpresa || '', cargo: c.cargo || '', endereco: c.morada, provincia: c.provincia, pais: 'Mozambique' };
  const gravarPerfil = () =>
    saveProfileForAuthUser(admin, userId, {
      email: c.email,
      role: 'guest',
      name: nome || c.email.split('@')[0],
      telefone: c.telefone,
      empresa: c.empresa || undefined,
      morada: c.morada,
      cidade: c.provincia,
    });

  let userId = '';
  let contaCriada = false;
  let senhaDefinida = false;
  if (!senha || senha.length < 6) {
    // sem palavra-passe guardada só serve um login que já exista
    const existente = await utilizadorPorEmail(admin, c.email);
    if (!existente) throw new Error('A palavra-passe guardada neste pedido não é válida; peça ao cliente para refazer a compra.');
    userId = existente.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: c.email, password: senha, email_confirm: true, user_metadata: { role: 'guest', ...metadados } });
    if (!error && data.user) {
      userId = data.user.id;
      contaCriada = true;
      senhaDefinida = true;
      await gravarPerfil();
    } else {
      // o e-mail já tinha login: se estiver vazio, passa a ser desta compra; se for uma conta a sério, fica como está
      const existente = await utilizadorPorEmail(admin, c.email);
      if (!existente) throw new Error(error?.message || 'Não foi possível criar a conta do cliente.');
      userId = existente.id;
      if (!(await temContaReal(admin, existente))) {
        const { error: erroSenha } = await admin.auth.admin.updateUserById(userId, {
          password: senha,
          email_confirm: true,
          user_metadata: { ...(existente.user_metadata || {}), ...metadados },
        });
        if (erroSenha) throw new Error(erroSenha.message || 'Não foi possível actualizar o login do cliente.');
        senhaDefinida = true;
        await gravarPerfil();
      }
    }
  }

  // o pedido passa a ter dono; a palavra-passe cifrada e a chave deixam de ser precisas
  const { senha: _senha, ...semSenha } = c;
  void _senha;
  await admin.from('checkout_sessions').update({ user_id: userId, cadastro: semSenha, token_acesso: null }).eq('id', session.id);
  return { userId, contaCriada, senhaDefinida };
}
