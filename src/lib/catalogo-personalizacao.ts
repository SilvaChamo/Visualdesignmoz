// Nomes em português dos métodos e das posições de personalização do catálogo de brindes (o fornecedor dá-os em inglês).
// O que não se conhece fica como vem. Sem dependências: seguro em componentes de cliente.

const METODOS: [RegExp, string][] = [
  [/^embroider/i, 'Bordado'],
  [/screen ?print/i, 'Serigrafia'],
  [/digital (direct )?transfer|dtc|dtf/i, 'Transferência digital'],
  [/heat ?press|heat transfer/i, 'Termotransferência'],
  [/sublimation/i, 'Sublimação'],
  [/laser/i, 'Gravação a laser'],
  [/pad ?print/i, 'Tampografia'],
  [/uv/i, 'Impressão UV'],
  [/deboss/i, 'Baixo-relevo'],
  [/emboss/i, 'Relevo seco'],
  [/foil/i, 'Hot stamping (película)'],
  [/doming|resin/i, 'Resina (doming)'],
  [/silicone/i, 'Silicone'],
  [/woven|label/i, 'Etiqueta tecida'],
  [/patch/i, 'Emblema'],
  [/full ?colour|full ?color|digital print/i, 'Impressão a cores'],
  [/transfer/i, 'Transferência'],
  [/print/i, 'Impressão'],
]

/** «Embroidery (Clothing)» → «Bordado»; «Screen Print (A)» → «Serigrafia». */
export function nomeMetodo(en: string): string {
  return METODOS.find(([re]) => re.test(en))?.[1] ?? en
}

export function corMetodo(c: string | null): string | null {
  if (!c) return null
  const n = /(\d+)\s*colou?r/i.exec(c)
  if (n) return `${n[1]} ${Number(n[1]) === 1 ? 'cor' : 'cores'}`
  if (/full/i.test(c)) return 'Todas as cores'
  return c
}

const POSICOES: Record<string, string> = {
  'main branding area': 'Área principal',
  'left chest': 'Peito esquerdo',
  'right chest': 'Peito direito',
  front: 'Frente',
  back: 'Costas',
  'full back': 'Costas inteiras',
  'upper back': 'Costas (parte de cima)',
  'left sleeve': 'Manga esquerda',
  'right sleeve': 'Manga direita',
  nape: 'Nuca',
  barrel: 'Corpo',
  body: 'Corpo',
  cover: 'Capa',
  'front cover': 'Capa da frente',
  'notebook front cover': 'Capa da frente do caderno',
  lid: 'Tampa',
  clip: 'Clip',
  'pen barrel': 'Corpo da caneta',
  'jar body': 'Corpo do frasco',
  'front pocket': 'Bolso da frente',
  'main panel': 'Painel principal',
  'front panel': 'Painel da frente',
  'front of bag': 'Frente da mala',
  'front of banner': 'Frente do banner',
  'side 1': 'Lado 1',
  'side 2': 'Lado 2',
  'opposite side': 'Lado oposto',
  'on the tube system': 'No sistema de tubo',
}

/** «Left Chest / Front» → «Peito esquerdo / Frente»; «Position G» → «Posição G». O que não se conhece fica como vem. */
export function nomePosicao(en: string): string {
  const partes = en.split('/').map((p) => {
    const t = p.trim()
    const letra = /^position ([a-z0-9]+)$/i.exec(t)
    return letra ? `Posição ${letra[1].toUpperCase()}` : (POSICOES[t.toLowerCase()] ?? t)
  })
  return [...new Set(partes)].join(' / ')
}
