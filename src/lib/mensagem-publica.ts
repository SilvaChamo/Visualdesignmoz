/**
 * Mensagens de erro para quem as vê (Silva, 26/10/2026): as públicas são genéricas e nunca nomeiam fornecedores nem mostram detalhes
 * técnicos; as de administração vêm explícitas (que serviço falhou e porquê). As bibliotecas devolvem sempre o erro real; é aqui,
 * na fronteira das rotas, que se decide o que cada pessoa vê.
 */

export const MENSAGEM_GENERICA = 'O pedido não foi aprovado. Tente de novo dentro de instantes; se continuar, contacte o suporte.';

/** Serviços de terceiros que o público não deve ver nomeados. */
const TERCEIROS = /\b(cloudflare|brevo|sendinblue|contabo|hestia(?:cp)?|dynadot|vercel|supabase|directadmin|hetzner|exim|dovecot|roundcube|rclone)\b/i;

/** Marcas de um erro cru de uma API ou de um comando (inglês, códigos, comandos, caminhos, JSON). */
const TECNICO = /\b(error|exception|undefined|econn\w*|etimedout|eai_again|fetch failed|socket hang up|stack|http\s*\d{3}|status\s*\d{3}|code\s*\d+)\b|v-[a-z]+(?:-[a-z]+)+|\/(?:usr|etc|home|var)\/|\{[^}]*"[^}]*\}|\(\d{3,5}\)/i;

/**
 * O que mostrar. `admin`: o erro tal como veio. Os outros: o próprio texto se for uma frase nossa (portuguesa, sem terceiros nem
 * detalhes técnicos), senão `quando` — uma frase genérica que diz o que fazer a seguir (por omissão, pedir ajuda ao suporte).
 */
export function mensagemPublica(erro: string | undefined | null, admin: boolean, quando: string = MENSAGEM_GENERICA): string {
  const e = (erro || '').trim();
  if (admin) return e || quando;
  if (!e || TERCEIROS.test(e) || TECNICO.test(e)) return quando;
  return e;
}
