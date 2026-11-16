// Brindes do catálogo (importados da África do Sul): só se importa a partir de 25 unidades de cada produto; abaixo disso o pedido passa a ser de produtos locais (Moçambique).
export const MINIMO_IMPORTACAO_BRINDE = 25

export const AVISO_IMPORTACAO_BRINDE = `Para importar da África do Sul só se aceitam ${MINIMO_IMPORTACAO_BRINDE} unidades ou mais de cada produto. Abaixo disso, este pedido é substituído por produtos locais, em Moçambique.`

// o pedido de brindes escreve cada linha assim: «nome — ref. SKU (marca) — o que foi escolhido» (ver components/brindes/pedido.ts)
const REF_BRINDE = / — ref\. (\S+)(?: \([^)]*\))?(?: — (.*))?$/

/** Linha de um brinde do catálogo (importado)? */
export const ehBrindeDoCatalogo = (descricao: string) => REF_BRINDE.test(descricao)

/** Brinde do catálogo com menos unidades do que o mínimo para importar. */
export const abaixoDoMinimoImportacao = (descricao: string, quantidade: number) => ehBrindeDoCatalogo(descricao) && quantidade < MINIMO_IMPORTACAO_BRINDE

/** A linha que substitui o brinde importado: pede-se um produto local semelhante (sem « — ref. », para a calculadora de importação não a tratar como importação). */
export function pedidoLocal(descricao: string): string {
  const m = REF_BRINDE.exec(descricao)
  if (!m) return descricao
  return `Produto local (Moçambique), em vez do importado: ${descricao.slice(0, m.index)} (ref. ${m[1]})${m[2] ? ` — ${m[2]}` : ''}`.slice(0, 255)
}
