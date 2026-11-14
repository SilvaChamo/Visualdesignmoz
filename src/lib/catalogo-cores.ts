// Cores do catálogo de brindes: nome em português e família de cor (para o filtro por cor).
// Sem dependências do ficheiro de produtos: seguro em componentes de cliente.

const PALAVRAS: Record<string, string> = {
  black: 'preto', white: 'branco', grey: 'cinzento', gray: 'cinzento', charcoal: 'carvão', silver: 'prateado', graphite: 'grafite',
  navy: 'azul-marinho', blue: 'azul', royal: 'royal', cyan: 'ciano', aqua: 'água', turquoise: 'turquesa', teal: 'petróleo', sky: 'céu',
  red: 'vermelho', burgundy: 'bordeaux', maroon: 'grená', wine: 'vinho', cherry: 'cereja',
  green: 'verde', lime: 'lima', olive: 'azeitona', emerald: 'esmeralda', mint: 'menta', bottle: 'garrafa', forest: 'floresta',
  yellow: 'amarelo', gold: 'dourado', mustard: 'mostarda',
  orange: 'laranja', amber: 'âmbar', coral: 'coral', rust: 'ferrugem',
  pink: 'rosa', magenta: 'magenta', fuchsia: 'fúcsia', rose: 'rosa',
  purple: 'roxo', violet: 'violeta', lilac: 'lilás', lavender: 'lavanda', plum: 'ameixa',
  brown: 'castanho', chocolate: 'chocolate', coffee: 'café', tan: 'castanho-claro', copper: 'cobre', bronze: 'bronze',
  beige: 'bege', stone: 'pedra', sand: 'areia', cream: 'creme', natural: 'natural', khaki: 'caqui', taupe: 'toupeira', ivory: 'marfim', champagne: 'champanhe',
  clear: 'transparente', transparent: 'transparente', multi: 'multicolor', multicolour: 'multicolor', assorted: 'variadas', mixed: 'variadas', camo: 'camuflado',
  military: 'militar', moss: 'musgo', ocean: 'oceano', burnt: 'queimado', solid: 'sólido', off: 'off',
  and: 'e', with: 'com',
}
const MODIFICADORES: Record<string, string> = { light: 'claro', dark: 'escuro', bright: 'vivo', pale: 'claro', neon: 'néon', pastel: 'pastel', deep: 'escuro' }

// «Royal Blue» diz-se «azul royal»: a cor de base vem primeiro e o que a descreve depois
const BASE = new Set(['blue', 'green', 'grey', 'gray', 'red', 'yellow', 'orange', 'brown', 'white', 'black', 'pink', 'purple'])
const DESCRITORES = new Set(['royal', 'sky', 'ocean', 'new', 'moss', 'military', 'burnt', 'solid', 'off', 'natural', 'old', 'bottle', 'forest'])

/** «NAVY / WHITE» → «Azul-marinho / Branco»; «LIGHT BLUE» → «Azul claro»; «ROYAL BLUE» → «Azul royal». O que não se conhece fica como vem. */
export function nomeCor(en: string | null | undefined): string {
  if (!en) return ''
  const partes = en.split(/\s*[/,]\s*/).map((parte) => {
    const palavras = parte.toLowerCase().split(/[\s-]+/).filter(Boolean)
    const pt = (w: string) => PALAVRAS[w] ?? w
    const cores: string[] = []
    let pendentes: string[] = []
    for (const w of palavras.filter((x) => !(x in MODIFICADORES))) {
      if (BASE.has(w)) {
        cores.push(pt(w), ...pendentes.map(pt))
        pendentes = []
      } else if (DESCRITORES.has(w)) pendentes.push(w)
      else {
        cores.push(...pendentes.map(pt), pt(w))
        pendentes = []
      }
    }
    cores.push(...pendentes.map(pt))
    const mods = palavras.filter((w) => w in MODIFICADORES).map((w) => MODIFICADORES[w])
    return [...cores, ...mods].filter((w, i, l) => w !== l[i - 1]).join(' ')
  })
  const t = partes.join(' / ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export interface FamiliaCor {
  id: string
  nome: string
  hex: string
}

export const FAMILIAS_COR: FamiliaCor[] = [
  { id: 'preto', nome: 'Preto', hex: '#111111' },
  { id: 'branco', nome: 'Branco', hex: '#ffffff' },
  { id: 'cinzento', nome: 'Cinzento', hex: '#8a8d91' },
  { id: 'azul', nome: 'Azul', hex: '#2563eb' },
  { id: 'vermelho', nome: 'Vermelho', hex: '#dc2626' },
  { id: 'verde', nome: 'Verde', hex: '#16a34a' },
  { id: 'amarelo', nome: 'Amarelo', hex: '#facc15' },
  { id: 'laranja', nome: 'Laranja', hex: '#f97316' },
  { id: 'rosa', nome: 'Rosa', hex: '#ec4899' },
  { id: 'roxo', nome: 'Roxo', hex: '#7c3aed' },
  { id: 'castanho', nome: 'Castanho', hex: '#7c4a2d' },
  { id: 'bege', nome: 'Bege', hex: '#d6c3a3' },
]

/** A família de uma cor a partir do hexadecimal («#5F605B» → cinzento): vale para qualquer cor, em qualquer língua. */
export function familiaDaCor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 'cinzento'
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = (h * 60 + 360) % 360
  }
  if (l < 0.13) return 'preto'
  if (l > 0.93 && s < 0.5) return 'branco'
  if (s < 0.13) return l > 0.85 ? 'branco' : 'cinzento'
  if (h < 14 || h >= 345) return l < 0.3 && s < 0.6 ? 'castanho' : 'vermelho'
  if (h < 40) return l < 0.42 ? 'castanho' : l > 0.68 && s < 0.65 ? 'bege' : 'laranja'
  if (h < 68) return l > 0.7 && s < 0.5 ? 'bege' : l < 0.4 ? 'verde' : 'amarelo'
  if (h < 165) return 'verde'
  if (h < 260) return 'azul'
  if (h < 295) return 'roxo'
  return 'rosa'
}
