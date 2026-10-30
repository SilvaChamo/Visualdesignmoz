/**
 * Os pacotes do servidor chamavam-se `VD-Host-Pro`, `VD-Email-Basico`, `VD-Dominio`; agora chamam-se `vhost-pro`, `vhost-email-basico`,
 * `vhost-dominio` (Silva, 30/10/2026). A chave junta os dois nomes (sem maiúsculas, `_` como `-`), para o sistema reconhecer o pacote
 * seja qual for o nome que ele tenha no servidor.
 */
export function chavePacote(nome: string | null | undefined): string {
  return String(nome || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/^vd-host-/, 'vhost-')
    .replace(/^vd-/, 'vhost-');
}
