// Totais da folha da cotação de uma ENCOMENDA do site (a folha do administrador e a do cliente): a mesma conta que a factura, o cartão do cliente e o pagamento fazem
// (encomenda-checkout.ts › encomendaPaymentSplit): a soma sem IVA das linhas (preço sem IVA de 2 casas × quantidade, como se grava em quotation_requests), o IVA sobre essa
// soma e o total. Sem imports: o teste corre com `node --test`, que não resolve imports com alias.

const arredondar2 = (n: number) => Math.round(n * 100) / 100

/** Valor sem IVA de uma linha, como a base de dados o guarda: o preço unitário (2 casas) × a quantidade. */
export const totalDaLinhaSemIva = (precoSemIva: number, unidades: number) => arredondar2(arredondar2(precoSemIva) * unidades)

/** Subtotal (sem IVA), IVA e total a pagar; com 16 % dá o mesmo que `encomendaPaymentSplit`. */
export function totaisDaEncomenda(linhas: { precoSemIva: number; unidades: number }[], ivaPct: number) {
  const subtotal = arredondar2(linhas.reduce((t, l) => t + (Number.isFinite(l.unidades) ? totalDaLinhaSemIva(l.precoSemIva, l.unidades) : 0), 0))
  const ivaValor = arredondar2(subtotal * (ivaPct / 100))
  return { subtotal, ivaValor, total: arredondar2(subtotal + ivaValor) }
}
