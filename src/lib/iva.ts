/**
 * IVA de Moçambique (16 %) nas compras do carrinho (Silva, 28/10/2026: «aplicar IVA»).
 *
 * Os preços do carrinho (domínios, hospedagem, e-mail) são preços finais: o cliente paga o que vê, por isso o IVA
 * vem **incluído** e só se discrimina no recibo (valor sem IVA + IVA = total pago). Nenhum valor cobrado muda.
 * As encomendas à parte acrescentam o IVA ao preço (`encomendaPaymentSplit`, em `encomenda-checkout.ts`).
 */
export const IVA_TAXA = 0.16;

const arredonda = (v: number) => Math.round(v * 100) / 100;

/** Separa um total com IVA incluído em valor sem IVA e IVA (a soma dá sempre o total). */
export function separarIvaIncluido(totalMt: number, taxa: number = IVA_TAXA) {
  const total = arredonda(totalMt);
  const semIvaMt = arredonda(total / (1 + taxa));
  return { semIvaMt, ivaMt: arredonda(total - semIvaMt), totalMt: total };
}
