// Taxa de preparação da impressão (setup) de cada produto de uma encomenda: o fornecedor cobra o mesmo valor por produto (R400 mais o IVA sul-africano de 15 % = R460,
// cotação BF-MWBWHJVJ-JHTJ da Brandful) e o custo unitário da impressão é esse valor dividido pelas unidades que o cliente pediu. Sem imports: o teste corre com `node --test`.

/** O valor fixo da preparação por produto, em rand, com o IVA sul-africano. */
export const PREPARACAO_IMPRESSAO = 460

/** Custo unitário da impressão (em rand) de um produto com estas unidades: a preparação fixa repartida por todas; '0' se as unidades não valem. */
export function impressaoUnitariaFixa(unidades: number): string {
  return unidades > 0 ? String(Math.round((PREPARACAO_IMPRESSAO / unidades) * 1e8) / 1e8) : '0'
}
