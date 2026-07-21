export type PriceItem = {
  name: string
  price: number
}

export type Category = {
  id: string
  label: string
  subtitle: string
  minQty: string
  items: PriceItem[]
}

export const CATEGORIES: Category[] = [
  {
    id: 'cartoes',
    label: 'Cartões de Visita',
    subtitle: 'Cartões de visita em vários acabamentos.',
    minQty: 'Quantidade mínima: 50 unidades',
    items: [
      { name: 'Cartolina 300g, Preto e Branco — 1 Face', price: 9.36 },
      { name: 'Cartolina 300g, Preto e Branco — Frente e Verso', price: 16.38 },
      { name: 'Cartolina 300g, Colorido — 1 Face', price: 12.87 },
      { name: 'Cartolina 300g, Colorido — Frente e Verso', price: 17.55 },
      { name: 'Laminado 120g, Colorido — 1 Face', price: 14.04 },
      { name: 'Laminado 120g, Colorido — Frente e Verso', price: 17.55 },
      { name: 'Papel Especial 300g, Colorido — 1 Face', price: 19.89 },
      { name: 'Papel Especial 300g, Colorido — Frente e Verso', price: 19.89 },
    ],
  },
  {
    id: 'flyers',
    label: 'Flyers & Panfletos',
    subtitle: 'Panfletos e folhetos em vários formatos.',
    minQty: 'Quantidade mínima: 50 unidades',
    items: [
      { name: 'DL — 1 Face', price: 17.55 },
      { name: 'DL — 2 Faces', price: 20.48 },
      { name: 'DL — 2 Dobras, Frente e Verso', price: 70.20 },
      { name: 'DL — 3 Dobras, Frente e Verso', price: 81.90 },
      { name: 'A5 — 1 Face', price: 22.23 },
      { name: 'A5 — Frente e Verso', price: 30.42 },
      { name: 'A4 — 1 Face, Frente e Verso', price: 40.95 },
      { name: 'A4 — 2 Faces, Frente e Verso', price: 64.35 },
    ],
  },
  {
    id: 'blocos',
    label: 'Blocos de Factura & Recibo',
    subtitle: 'Blocos personalizados para a sua empresa.',
    minQty: 'Quantidade mínima: 5 blocos',
    items: [
      { name: 'A5, Preto e Branco, Normal', price: 409.50 },
      { name: 'A5, Colorido, Normal', price: 491.40 },
      { name: 'A4, Preto e Branco, Normal', price: 561.60 },
      { name: 'A4, Colorido, Normal', price: 702 },
      { name: 'A5, Papel NSR, Triplicado', price: 702 },
      { name: 'A4, Papel NSR, Triplicado', price: 836.55 },
    ],
  },
  {
    id: 'papelaria',
    label: 'Papelaria Corporativa',
    subtitle: 'Papel timbrado para correspondência da empresa.',
    minQty: 'Quantidade mínima: 2 resmas',
    items: [
      { name: 'Papel Timbrado (Resma)', price: 1872 },
      { name: 'Papel Timbrado com Fundo no Meio da Folha (Resma)', price: 2047.50 },
    ],
  },
  {
    id: 'publicidade',
    label: 'Publicidade Exterior',
    subtitle: 'Banners, autocolantes e anúncios.',
    minQty: 'Quantidade mínima: conforme o item',
    items: [
      { name: 'Anúncio A4', price: 2574 },
      { name: 'Autocolante em Vinil / Metro Quadrado', price: 1111.50 },
      { name: 'Banner em Lona / Metro Quadrado', price: 936 },
      { name: 'RollUp Banner Simples (mín. 2)', price: 7605 },
      { name: 'RollUp Banner Executivo (mín. 2)', price: 7605 },
    ],
  },
  {
    id: 'texteis',
    label: 'Têxteis & Serigrafia',
    subtitle: 'Estampagem, bordados e fardamento personalizado.',
    minQty: 'Quantidade mínima: 20 unidades',
    items: [
      { name: 'Estampagem', price: 140.40 },
      { name: 'Bordados', price: 152.10 },
      { name: 'Camisete Polo, Normal — Bordado', price: 432.90 },
      { name: 'Camisete Polo, Executiva — Bordado', price: 409.50 },
      { name: 'Camisete Simples — Estampada', price: 432.90 },
      { name: 'Camisete Polo — Estampada', price: 362.70 },
    ],
  },
  {
    id: 'video',
    label: 'Produção de Vídeo',
    subtitle: 'Filmagem e edição para eventos e publicidade.',
    minQty: '',
    items: [
      { name: 'Filmagem de Evento, Festa ou Aniversário (1 dia)', price: 17550 },
      { name: 'Filmagem de Casamento (1 dia)', price: 9945 },
      { name: 'Filmagem de Documentário, Duas Câmaras', price: 40950 },
      { name: 'Filmagem e Edição de Spot Publicitário (15 a 30seg)', price: 32760 },
    ],
  },
  {
    id: 'fotografia',
    label: 'Fotografia',
    subtitle: 'Entrega digital ou impressa.',
    minQty: '',
    items: [
      { name: 'Imagens Digitais, entrega em flash (por postal)', price: 35.10 },
      { name: 'Imagens Impressão, Tamanho Normal (2 postais)', price: 100.62 },
    ],
  },
]

export function formatMt(value: number) {
  const rounded = Math.round(value * 100) / 100
  const isWhole = Number.isInteger(rounded)
  return rounded.toLocaleString('pt-PT', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export function findCategory(categoryId: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === categoryId)
}

export function findItem(categoryId: string, productName: string): { category: Category; item: PriceItem } | undefined {
  const category = findCategory(categoryId)
  if (!category) return undefined
  const item = category.items.find((i) => i.name === productName)
  if (!item) return undefined
  return { category, item }
}
