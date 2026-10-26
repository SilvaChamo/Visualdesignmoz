/**
 * Depois de pagar, volta-se ao painel quando se veio de lá (Silva, 17/10/2026: "a lógica deveria ser esta"). O painel
 * (Gestão › Encomendas) deixa marcado neste separador do navegador para onde voltar; o checkout e a página de pagamento
 * da encomenda usam essa marca em vez da /encomendas do site. Sem marca (quem entrou pelo site), fica tudo como antes.
 * sessionStorage: vale só para este separador e desaparece ao fechá-lo.
 */
const CHAVE = 'vd-voltar-painel';

export function marcarVoltaAoPainel(caminho: string) {
  try {
    sessionStorage.setItem(CHAVE, '/vhost:2026' + caminho);
  } catch {
    /* sem armazenamento: volta-se para a página por omissão */
  }
}

/** Para onde ir depois do pagamento: o painel, se se veio de lá; senão `padrao` */
export function destinoDepoisDoPagamento(padrao: string): string {
  try {
    const c = typeof window !== 'undefined' ? sessionStorage.getItem(CHAVE) : null;
    // só caminhos do próprio painel (nunca outro site)
    if (c && /^\/vhost:2026(\/[\w\-/]*)?$/.test(c)) return c;
  } catch {
    /* sem armazenamento */
  }
  return padrao;
}
