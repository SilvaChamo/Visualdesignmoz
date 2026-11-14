// Importa a ficha completa de cada produto do catálogo de brindes para src/data/catalogo-fichas/NN.json (32 ficheiros):
// stock por cor e tamanho (e o que está a chegar), tamanhos, cores com imagem, galeria, medidas, posições e métodos
// de personalização com a área máxima, medidas da caixa. Complementa src/data/catalogo-brindes.json (a lista).
//
//   node scripts/importar-fichas-brindes.mjs ler [--particao i/n] [--pausa ms] [--limite n]   lê as fichas e guarda-as na pasta temporária
//   node scripts/importar-fichas-brindes.mjs juntar [--parcial]                                junta o que foi lido e escreve os ficheiros finais (--parcial: só os que já foram lidos, para ensaiar)
//   --pasta <dir>   onde guardar o que já foi lido (retoma onde parou; por defeito, na pasta temporária)
//
// Tal como o importador da lista: só lê páginas que o robots.txt do fornecedor permite (/products/…), com um nome de
// cliente identificado, com pausa entre pedidos, e pára se o servidor pedir para abrandar (429/403). Importa só factos
// (números, medidas, nomes de cores e de métodos); NÃO copia os textos de descrição nem os de marketing. Os preços
// (do produto e da personalização) não entram: ficam para a calculadora, no servidor.

import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://brandful.co.za'
const AGENTE = 'Mozilla/5.0 (compatible; VisualDesignCatalogo/1.0; +https://visualdesignmoz.com)'
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const LISTA = join(RAIZ, 'src', 'data', 'catalogo-brindes.json')
const SAIDA = join(RAIZ, 'src', 'data', 'catalogo-fichas')
const PARTES = 32 // a mesma conta está em src/lib/catalogo-fichas.ts (ficheiroDaFicha)
const parteDoSku = (sku) => [...sku].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PARTES
const PREFIXO_IMG = 'https://amrcdn.amrod.co.za/amrodprod-blob/'

const args = process.argv.slice(2)
const fase = args.find((a) => !a.startsWith('--')) || 'ler'
const opcao = (nome, def) => {
  const i = args.indexOf(`--${nome}`)
  return i >= 0 ? args[i + 1] : def
}
const PAUSA = Number(opcao('pausa', 1200))
const PASTA = opcao('pasta', join(tmpdir(), 'fichas-brindes'))
mkdirSync(PASTA, { recursive: true })
const dorme = (ms) => new Promise((r) => setTimeout(r, ms))

async function buscar(url, tentativas = 4) {
  for (let t = 1; t <= tentativas; t++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': AGENTE, accept: 'text/html' }, signal: AbortSignal.timeout(30000) })
      if (r.status === 429 || r.status === 403) throw new Error(`o servidor respondeu ${r.status} a ${url}; parar e tentar mais tarde`)
      if (r.status >= 500) throw new Error(`erro ${r.status}`)
      if (r.status === 404) return null
      if (!r.ok) throw new Error(`estado ${r.status}`)
      return await r.text()
    } catch (e) {
      if (String(e.message).includes('parar e tentar mais tarde') || t === tentativas) throw e
      await dorme(PAUSA * t * 2)
    }
  }
}

/** O texto do Next.js («self.__next_f.push») desfeito num só texto, para ler os dados estruturados que a página já traz. */
function dadosDaPagina(html) {
  const blocos = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)]
  return blocos.map((m) => JSON.parse(m[1])).join('')
}

/** O objecto `{…}` que começa em `inicio`, respeitando textos entre aspas. */
function objecto(texto, inicio) {
  let n = 0
  let emTexto = false
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i]
    if (emTexto) {
      if (c === '\\') i++
      else if (c === '"') emTexto = false
    } else if (c === '"') emTexto = true
    else if (c === '{') n++
    else if (c === '}' && --n === 0) return JSON.parse(texto.slice(inicio, i + 1))
  }
  throw new Error('objecto sem fim')
}

// Imagens: guarda-se só o fim do endereço. As que estão na pasta do produto (ProductImages/<código>/…) ficam só com o
// nome do ficheiro; as outras ficam com o caminho a partir da raiz do armazenamento.
const relativa = (sku) => (u) => {
  if (!u) return null
  const sem = u.startsWith(PREFIXO_IMG) ? u.slice(PREFIXO_IMG.length) : u
  const pasta = `ProductImages/${sku}/`
  return sem.startsWith(pasta) ? sem.slice(pasta.length) : sem
}

const ORDEM_TAMANHOS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL']
const chaveTamanho = (t) => {
  const i = ORDEM_TAMANHOS.indexOf(String(t).toUpperCase())
  if (i >= 0) return [0, i, '']
  const n = parseFloat(t)
  return Number.isFinite(n) ? [1, n, String(t)] : [2, 0, String(t)]
}
const porTamanho = (a, b) => {
  const [x, y] = [chaveTamanho(a), chaveTamanho(b)]
  return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2])
}

/** A ficha compacta de um produto, só com factos. */
function fichaDoHtml(html, sku) {
  const rel = relativa(sku)
  const dados = dadosDaPagina(html)
  const i = dados.indexOf('"fullProduct":{')
  if (i < 0) throw new Error('ficha sem os dados completos do produto')
  const p = objecto(dados, i + '"fullProduct":'.length)

  const tamanhos = [...new Set((p.sizes ?? []).map(String))].sort(porTamanho)
  // stock por cor e tamanho: [em stock, a chegar, data da chegada]
  const v = {}
  for (const x of p.variants ?? []) {
    const cor = (v[x.colourCode ?? '-'] ??= {})
    cor[x.sizeName ?? '-'] = [x.stock ?? 0, x.incomingStock ?? 0, x.incomingDate ? x.incomingDate.slice(0, 10) : '']
  }
  const extras = new Map((p.colorOptions ?? []).map((c) => [c.code, (c.allImages ?? []).map((a) => rel(a.url))]))
  const cores = (p.colours ?? []).map((c) => {
    const i0 = rel(c.imageUrl)
    return { c: c.code, n: c.name, h: c.hex ?? [], i: i0, x: (extras.get(c.code) ?? []).filter((u) => u && u !== i0).slice(0, 3) }
  })
  const gal = (p.images ?? []).map((g) => [rel(g.url), g.hasLogo ? 1 : 0])

  // posições de personalização: o guia (local + métodos com a área em mm) é a fonte; sem guia ficam só os nomes
  let pos = (p.brandingGuide?.positions ?? []).map((q) => ({
    p: q.code,
    n: q.location,
    m: (q.methods ?? []).map((m) => ({ n: m.name, c: m.colours ?? null, w: m.maxWidthMm ?? null, h: m.maxHeightMm ?? null })),
  }))
  if (!pos.length) {
    pos = (p.productBrandingPositions ?? []).map((q) => ({
      p: q.position,
      n: q.name,
      m: [...new Set((q.methods ?? []).map((m) => m.name))].map((n) => ({ n, c: null, w: null, h: null })),
    }))
  }

  const esp = { ...(p.specifications ?? {}) }
  const mat = esp.Material ?? p.material ?? null
  delete esp.Material
  const med = Object.fromEntries(Object.entries(p.productMeasurements ?? {}).map(([t, m]) => [t, [m.productLength, m.productWidth, m.productWeight]]))
  const cx = Object.fromEntries(Object.entries(p.cartonSpecsBySize ?? {}).map(([t, c]) => [t, [c.piecesPerCarton, c.cartonLength, c.cartonWidth, c.cartonHeight, c.cartonWeight]]))

  return {
    mat,
    esp,
    tam: tamanhos,
    cores,
    v,
    st: p.totalStock ?? 0,
    min: p.minimum ?? 1,
    inc: p.incrementedBy ?? 1,
    gal,
    pos,
    pdf: rel(p.brandingGuideUrl),
    med,
    cx,
    urg: Boolean(p.rushEligible),
    mto: Boolean(p.isMadeToOrder),
    ...(p.discontinued ? { desc: true } : {}),
  }
}

async function ler() {
  const lista = JSON.parse(readFileSync(LISTA, 'utf8')).produtos
  const [parte, partes] = opcao('particao', '0/1').split('/').map(Number)
  const ficheiro = join(PASTA, `fichas-${parte}-de-${partes}.jsonl`)
  const feitas = new Set()
  if (existsSync(ficheiro)) for (const l of readFileSync(ficheiro, 'utf8').split('\n')) if (l) feitas.add(JSON.parse(l).sku)
  const falta = lista.filter((p, i) => i % partes === parte && !feitas.has(p.sku)).slice(0, Number(opcao('limite', Infinity)))
  console.log(`[${parte}/${partes}] ${feitas.size} já lidas, ${falta.length} por ler`)
  let n = 0
  for (const p of falta) {
    const html = await buscar(`${BASE}/products/${p.slug}`)
    const ficha = html ? fichaDoHtml(html, p.sku) : null
    appendFileSync(ficheiro, JSON.stringify({ sku: p.sku, ficha }) + '\n')
    n++
    if (n % 25 === 0 || n === falta.length) console.log(`[${parte}/${partes}] ${feitas.size + n}/${feitas.size + falta.length}`)
    await dorme(PAUSA)
  }
}

function juntar() {
  const lista = JSON.parse(readFileSync(LISTA, 'utf8')).produtos
  const fichas = new Map()
  for (const f of readdirSync(PASTA).filter((f) => /^fichas-\d+-de-\d+\.jsonl$/.test(f))) {
    for (const l of readFileSync(join(PASTA, f), 'utf8').split('\n')) if (l) { const j = JSON.parse(l); fichas.set(j.sku, j.ficha) }
  }
  const sem = lista.filter((p) => !fichas.has(p.sku)).length
  if (sem && !args.includes('--parcial')) throw new Error(`faltam ${sem} fichas por ler`)
  const hoje = new Date().toISOString().slice(0, 10)
  mkdirSync(SAIDA, { recursive: true })
  const partes = Array.from({ length: PARTES }, () => [])
  let total = 0
  for (const p of lista) {
    const f = fichas.get(p.sku)
    if (!f) continue
    partes[parteDoSku(p.sku)].push(`${JSON.stringify(p.sku)}:${JSON.stringify(f)}`)
    total++
  }
  let bytes = 0
  partes.forEach((linhas, n) => {
    const texto = `{"atualizadoEm":"${hoje}","fichas":{\n${linhas.join(',\n')}\n}}\n`
    bytes += texto.length
    writeFileSync(join(SAIDA, `${String(n).padStart(2, '0')}.json`), texto)
  })
  console.log(`escrito ${SAIDA}: ${total} fichas em ${PARTES} ficheiros (${(bytes / 1e6).toFixed(2)} MB), ${lista.length - total} sem ficha`)
}

if (fase === 'juntar') juntar()
else await ler()
