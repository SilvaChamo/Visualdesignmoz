// Endereços das imagens do catálogo de brindes: passam todas por /api/brindes/imagem (ver a rota), nunca directo do
// fornecedor. Seguro para componentes de cliente (não lê o ficheiro de produtos).

export type LarguraImagem = 96 | 160 | 320 | 480 | 640 | 900 | 1200

/** `rel` como vem da lista («SKU/ficheiro.jpg») ou da ficha (só o nome do ficheiro, que está na pasta do produto). */
export const caminhoImagem = (sku: string, rel: string) => (rel.includes('/') ? rel : `${sku}/${rel}`)

export const urlImagem = (caminho: string, largura: LarguraImagem = 480) => `/api/brindes/imagem?p=${encodeURIComponent(caminho)}&w=${largura}`
