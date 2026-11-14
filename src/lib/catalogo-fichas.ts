// Ficha completa de cada produto do catálogo de brindes (stock por cor e tamanho, cores com fotos, galeria, medidas,
// posições e métodos de personalização): src/data/catalogo-fichas/NN.json, que scripts/importar-fichas-brindes.mjs escreve.
// Só factos e números, sem preços (esses ficam na lista, só para o servidor). Só para o servidor.
//
// Estão em 32 ficheiros para ler só o que um produto precisa: a conta do ficheiro é a mesma do script de importação.

export interface FichaCor {
  /** código da cor no fornecedor */
  c: string
  /** nome em inglês, como vem do fornecedor */
  n: string
  /** hexadecimais (uma cor tem 1 ou 2) */
  h: string[]
  /** fim do endereço da foto principal da cor e das outras fotos dela */
  i: string | null
  x: string[]
}

export interface FichaMetodo {
  n: string
  /** «1 colour», «full colour»… ou nada */
  c: string | null
  /** área máxima, em milímetros */
  w: number | null
  h: number | null
}

export interface Ficha {
  /** material */
  mat: string | null
  /** outras especificações, como vêm (Fit, Gender, Length, Width, Weight…) */
  esp: Record<string, string>
  /** tamanhos, já pela ordem natural (S, M, L…) */
  tam: string[]
  cores: FichaCor[]
  /** stock por cor e tamanho: { codigoDaCor: { tamanho ou «-»: [em stock, a chegar, data da chegada] } } */
  v: Record<string, Record<string, [number, number, string]>>
  /** stock total */
  st: number
  /** quantidade mínima e de quanto em quanto se pode pedir */
  min: number
  inc: number
  /** galeria: [fim do endereço, 1 se a foto já tem um logótipo de exemplo] */
  gal: [string, 0 | 1][]
  /** onde e como se pode personalizar */
  pos: { p: string; n: string; m: FichaMetodo[] }[]
  /** guia de personalização em PDF (fim do endereço) */
  pdf: string | null
  /** medidas por tamanho: [comprimento, largura, peso] */
  med: Record<string, [number, number, number]>
  /** caixa por tamanho: [unidades, comprimento, largura, altura, peso] */
  cx: Record<string, [number, number, number, number, number]>
  /** serve para pedidos urgentes / é feito por encomenda / já não se fabrica */
  urg: boolean
  mto: boolean
  desc?: boolean
}

const PARTES = 32
// a mesma conta que parteDoSku em scripts/importar-fichas-brindes.mjs
const parteDoSku = (sku: string) => [...sku].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PARTES

/** A ficha do produto e a data em que foi lida no fornecedor (o stock é dessa data); null se o produto não tem ficha. */
export async function fichaDoProduto(sku: string): Promise<{ ficha: Ficha; atualizadoEm: string } | null> {
  const n = String(parteDoSku(sku)).padStart(2, '0')
  const parte = await import(`../data/catalogo-fichas/${n}.json`)
  const dados = (parte.default ?? parte) as { atualizadoEm: string; fichas: Record<string, Ficha> }
  const ficha = dados.fichas[sku]
  return ficha ? { ficha, atualizadoEm: dados.atualizadoEm } : null
}

export const PREFIXO_PDF = 'https://amrcdn.amrod.co.za/amrodprod-blob/'
