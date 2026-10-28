/**
 * IVA de Moçambique (16 %) nas compras do carrinho.
 *
 * Silva, 28/10/2026: «mude no checkout» — o IVA passa a ser ACRESCENTADO ao preço dos itens (subtotal + IVA = total a pagar),
 * como já acontece nas encomendas (`encomendaPaymentSplit`, em `encomenda-checkout.ts`). `checkout_sessions.total_mt` guarda
 * o total JÁ com IVA (é o que o cliente paga em qualquer método).
 * As compras anteriores a esta data tinham o IVA incluído no preço; o recibo distingue as duas (`decomporCompra`).
 */
export const IVA_TAXA = 0.16;

const arredonda = (v: number) => Math.round(v * 100) / 100;

/** Subtotal dos itens → IVA acrescentado e total a pagar. */
export function acrescentarIva(subtotalMt: number, taxa: number = IVA_TAXA) {
  const subtotal = arredonda(subtotalMt);
  const ivaMt = arredonda(subtotal * taxa);
  return { subtotalMt: subtotal, ivaMt, totalMt: arredonda(subtotal + ivaMt) };
}

/** Separa um total com IVA incluído em valor sem IVA e IVA (a soma dá sempre o total). */
export function separarIvaIncluido(totalMt: number, taxa: number = IVA_TAXA) {
  const total = arredonda(totalMt);
  const semIvaMt = arredonda(total / (1 + taxa));
  return { semIvaMt, ivaMt: arredonda(total - semIvaMt), totalMt: total };
}

/**
 * Para o recibo: dada a soma dos preços das linhas e o total pago, diz de que lado está o IVA.
 * - total ≈ soma × 1,16 → IVA acrescentado (compras novas): subtotal = soma, IVA = total − soma;
 * - caso contrário → IVA incluído no preço (compras antigas): separa-se do total.
 */
export function decomporCompra(somaLinhasMt: number, totalMt: number) {
  const novo = acrescentarIva(somaLinhasMt);
  if (somaLinhasMt > 0 && Math.abs(novo.totalMt - totalMt) <= 0.02) {
    return { acrescentado: true, semIvaMt: novo.subtotalMt, ivaMt: novo.ivaMt, totalMt: novo.totalMt };
  }
  const inc = separarIvaIncluido(totalMt);
  return { acrescentado: false, semIvaMt: inc.semIvaMt, ivaMt: inc.ivaMt, totalMt: inc.totalMt };
}
