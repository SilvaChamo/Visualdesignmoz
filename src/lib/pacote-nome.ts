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

export type FamiliaPacote = 'email' | 'dominio' | 'hospedagem';

/**
 * De que tipo é um pacote, pelo nome — vale também para os pacotes que o administrador ainda vier a criar em Admin › Pacotes
 * (`vhost-qualquer-nome` é hospedagem; `vhost-email-…` só e-mail; `vhost-dominio` só domínio). Fora desta família (`default`,
 * `VisualDESIGN`, `Pro-…` dos revendedores) devolve null: nada muda para esses.
 */
export function familiaDoPacote(nome: string | null | undefined): FamiliaPacote | null {
  const chave = chavePacote(nome);
  if (chave.startsWith('vhost-email-')) return 'email';
  if (chave === 'vhost-dominio') return 'dominio';
  return chave.startsWith('vhost-') ? 'hospedagem' : null;
}

/** O plano de entrada de hospedagem (o «Básico»): quem o compra fica no painel Cliente e com um só domínio; os outros pacotes de hospedagem são de topo. */
export function eHospedagemBasica(nome: string | null | undefined): boolean {
  return /-(basico|basic|starter|inicial)$/.test(chavePacote(nome));
}
