/**
 * Nome de utilizador da conta de hospedagem (Silva, 29/10/2026): cada hospedagem comprada tem a sua conta no servidor, com o
 * seu domínio e o seu nome de utilizador, mesmo que quem compra já tenha outra conta com os mesmos dados pessoais.
 * Sem dependências de servidor: serve o checkout (validação ao escrever) e as rotas (validação final).
 */
export const NOME_CONTA_REGEX = /^[a-z][a-z0-9]{2,19}$/;
export const NOME_CONTA_ERRO = 'O nome de utilizador deve ter de 3 a 20 letras minúsculas e números, e começar por uma letra.';

/** Nomes que o servidor ou o sistema já usam. */
const RESERVADOS = new Set(['admin', 'administrator', 'root', 'www', 'mail', 'ftp', 'test', 'teste', 'system', 'hestia', 'vdadmin', 'default', 'support', 'suporte', 'postmaster', 'nobody', 'daemon', 'bin', 'sys']);

export function nomeContaValido(nome: string): boolean {
  return NOME_CONTA_REGEX.test(nome) && !RESERVADOS.has(nome);
}

/** Proposta a partir do domínio (oseudominio.co.mz → oseudominio): a pessoa pode mudá-la. */
export function sugerirNomeConta(dominio: string): string {
  const base = String(dominio || '').toLowerCase().split('.')[0].replace(/[^a-z0-9]/g, '').slice(0, 20);
  if (!base) return '';
  return /^[a-z]/.test(base) ? base : `c${base}`.slice(0, 20);
}
