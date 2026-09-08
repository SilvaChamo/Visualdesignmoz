/**
 * Extensões que a API da Dynadot NÃO regista (devolve sempre "Unsupported
 * domain type") — confirmado por teste a 15 TLDs, tanto na RESTful v1 como na
 * API3 legada, em Set 2026. São as duas do Google Registry. O site da Dynadot
 * regista-as normalmente; só o canal de API/revenda é que não.
 *
 * Uma compra destas extensões é aceite e paga, mas em vez de tentar registar
 * automaticamente (e falhar) o checkout marca o domínio como `pending` e
 * avisa a equipa para registar à mão na Dynadot e depois concluir no painel
 * com "Mover domínio para outra conta" + "Reprovisionar".
 */
export const MANUAL_REGISTRATION_TLDS = ['.app', '.dev'] as const;

export function requiresManualRegistration(domain: string): boolean {
  const d = String(domain || '').toLowerCase().trim();
  return MANUAL_REGISTRATION_TLDS.some((tld) => d.endsWith(tld));
}
