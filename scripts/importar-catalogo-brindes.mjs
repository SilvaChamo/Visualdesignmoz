// Importa o catálogo de brindes do fornecedor para src/data/catalogo-brindes.json.
//
//   node scripts/importar-catalogo-brindes.mjs lista              só a lista (uma página de 48 produtos de cada vez)
//   node scripts/importar-catalogo-brindes.mjs fichas             a ficha de cada produto: categoria, imagens, cores, caixa
//   node scripts/importar-catalogo-brindes.mjs tudo               lista + fichas + escreve o ficheiro final
//   --cache <ficheiro>   onde guardar as fichas já lidas (retoma onde parou; por defeito, na pasta temporária)
//   --pausa <ms>         pausa entre pedidos (por defeito 1200: cerca de 0,8 pedidos por segundo)
//   --limite <n>         lê só as n primeiras fichas por ler (para ensaiar)
//   --particao i/n       só os produtos cujo número de ordem dá resto i na divisão por n (n leitores ao mesmo tempo, cada um com a sua pausa)
//
// Só lê páginas que o robots.txt do fornecedor permite (nunca /api/, nem filtros, nem o carrinho), com um nome de cliente
// identificado e com pausa entre pedidos. Importa só factos (nome, código, marca, preço, estado, imagens, medidas da caixa);
// não copia os textos de descrição. O preço fica no ficheiro de dados para o servidor, nunca vai para o browser.
//
// A leitura confere-se a si própria e falha alto se algo não bater: 48 produtos por página (menos na última), o total do
// cabeçalho, nenhum código repetido.

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://brandful.co.za'
const LISTA = `${BASE}/amrod-catalogue`
const AGENTE = 'Mozilla/5.0 (compatible; VisualDesignCatalogo/1.0; +https://visualdesignmoz.com)'
const SAIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'catalogo-brindes.json')

const args = process.argv.slice(2)
const fase = args.find((a) => !a.startsWith('--')) || 'tudo'
const opcao = (nome, def) => {
  const i = args.indexOf(`--${nome}`)
  return i >= 0 ? args[i + 1] : def
}
const PAUSA = Number(opcao('pausa', 1200))
const CACHE = opcao('cache', join(tmpdir(), 'catalogo-brindes-fichas.jsonl'))
const CACHE_LISTA = CACHE.replace(/\.jsonl$/, '') + '-lista.json'

const dorme = (ms) => new Promise((r) => setTimeout(r, ms))

async function buscar(url, tentativas = 4) {
  for (let t = 1; t <= tentativas; t++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': AGENTE, accept: 'text/html' }, signal: AbortSignal.timeout(30000) })
      if (r.status === 429 || r.status === 403) {
        // o fornecedor pediu para abrandar ou recusou: não insistir
        throw new Error(`o servidor respondeu ${r.status} a ${url}; parar e tentar mais tarde`)
      }
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

function produtosDaLista(html) {
  const dados = dadosDaPagina(html)
  const out = []
  for (const m of dados.matchAll(/"product":(\{"id":"[^{}]*\})/g)) out.push(JSON.parse(m[1]))
  return out
}

function urlsDoJsonLd(html) {
  const m = html.match(/"@type":"ItemList"[^]*?"itemListElement":(\[[^]*?\])\}/)
  if (!m) return []
  return JSON.parse(m[1]).map((i) => i.url)
}

function fichaDoHtml(html) {
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([^]*?)<\/script>/g)]
    .map((m) => { try { return JSON.parse(m[1]) } catch { return null } })
    .find((j) => j && j['@type'] === 'Product')
  if (!ld) throw new Error('ficha sem os dados do produto')
  const cores = [...html.matchAll(/<button aria-label="([^"]+)" aria-pressed="[^"]*"[^>]*><span class="absolute inset-0" style="background:(#[0-9a-fA-F]{3,8})"/g)]
    .map((m) => ({ nome: m[1], hex: m[2] }))
  // tabela «Packaging and carton»: Size | Pcs/Carton | L | W | H | Weight (primeira linha)
  let caixa = null
  const t = html.match(/Packaging and carton<\/h3>[^]*?<tbody>([^]*?)<\/tbody>/)
  if (t) {
    const linha = t[1].match(/<tr[^>]*>([^]*?)<\/tr>/)
    const cel = linha ? [...linha[1].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((c) => Number(c[1].trim().replace(',', '.'))) : []
    if (cel.length >= 6 && cel.slice(1, 6).every((n) => Number.isFinite(n))) caixa = { unidades: cel[1], c: cel[2], l: cel[3], a: cel[4], kg: cel[5] }
  }
  return { categoria: ld.category || null, imagens: Array.isArray(ld.image) ? ld.image : [], cores, caixa }
}

async function fazerLista() {
  if (existsSync(CACHE_LISTA) && args.includes('--reusar-lista')) return JSON.parse(readFileSync(CACHE_LISTA, 'utf8'))
  const primeira = await buscar(LISTA)
  const total = Number(primeira.match(/<b class="font-semibold text-gray-900">([\d,]+)<\/b> products/)?.[1].replace(/,/g, ''))
  const paginas = Number(primeira.match(/ page 1 of (\d+)/)?.[1] ?? primeira.match(/page (?:<!-- -->)?1(?:<!-- -->)? of (?:<!-- -->)?(\d+)/)?.[1])
  if (!total || !paginas) throw new Error('não consegui ler o total de produtos e de páginas do cabeçalho')
  console.log(`catálogo: ${total} produtos em ${paginas} páginas`)
  const todos = []
  for (let p = 1; p <= paginas; p++) {
    const html = p === 1 ? primeira : await buscar(`${LISTA}?page=${p}`)
    const lista = produtosDaLista(html)
    const urls = urlsDoJsonLd(html)
    const esperados = p < paginas ? 48 : total - 48 * (paginas - 1)
    if (lista.length !== esperados) throw new Error(`página ${p}: li ${lista.length} produtos e esperava ${esperados}`)
    if (urls.length !== lista.length || urls.some((u, i) => !u.endsWith('/' + lista[i].slug))) throw new Error(`página ${p}: a lista de produtos não bate com a do índice da página`)
    todos.push(...lista)
    process.stdout.write(`\rlista: página ${p}/${paginas}`)
    if (p < paginas) await dorme(PAUSA)
  }
  console.log()
  if (todos.length !== total) throw new Error(`li ${todos.length} produtos e o cabeçalho diz ${total}`)
  if (new Set(todos.map((x) => x.code)).size !== total) throw new Error('há códigos repetidos na lista')
  writeFileSync(CACHE_LISTA, JSON.stringify(todos))
  return todos
}

async function fazerFichas(lista) {
  const feitas = new Map()
  if (existsSync(CACHE)) for (const l of readFileSync(CACHE, 'utf8').split('\n')) if (l) { const j = JSON.parse(l); feitas.set(j.code, j) }
  const [parte, partes] = opcao('particao', '0/1').split('/').map(Number)
  const falta = lista.filter((p, i) => i % partes === parte && !feitas.has(p.code)).slice(0, Number(opcao('limite', Infinity)))
  console.log(`fichas: ${feitas.size} já lidas, ${falta.length} por ler`)
  let n = 0
  for (const p of falta) {
    const html = await buscar(`${BASE}/products/${p.slug}`)
    const ficha = html ? fichaDoHtml(html) : { categoria: null, imagens: [], cores: [], caixa: null, semFicha: true }
    const linha = { code: p.code, ...ficha }
    appendFileSync(CACHE, JSON.stringify(linha) + '\n')
    feitas.set(p.code, linha)
    n++
    if (n % 25 === 0 || n === falta.length) process.stdout.write(`\rfichas: ${feitas.size}/${lista.length}`)
    await dorme(PAUSA)
  }
  console.log()
  return feitas
}

// As imagens ficam no armazenamento do fabricante; guarda-se só o fim do endereço (a página junta o princípio)
const PREFIXO_IMG = 'https://amrcdn.amrod.co.za/amrodprod-blob/ProductImages/'
const relativa = (u) => (u.startsWith(PREFIXO_IMG) ? u.slice(PREFIXO_IMG.length) : u)

function escrever(lista, fichas) {
  const produtos = lista.map((p) => {
    const f = fichas?.get(p.code)
    // a imagem da lista primeiro; depois as outras da ficha (até 4 no total)
    const imagens = [p.image, ...(f?.imagens ?? []).filter((u) => u !== p.image)].slice(0, 4).map(relativa)
    const o = {
      sku: p.code,
      slug: p.slug,
      nome: p.name,
      marca: p.brand || null,
      precoZar: p.price,
      esgotado: Boolean(p.out),
      promo: Boolean(p.promo),
      urgente: Boolean(p.rush),
      kit: Boolean(p.set),
      imagens,
    }
    if (f) {
      o.categoria = f.categoria
      if (f.cores?.length) o.cores = f.cores
      if (f.caixa) o.caixa = f.caixa
    }
    return o
  })
  const hoje = new Date().toISOString().slice(0, 10)
  // um produto por linha: o diff do git fica legível quando o catálogo muda
  const texto = `{"atualizadoEm":"${hoje}","produtos":[\n${produtos.map((p) => JSON.stringify(p)).join(',\n')}\n]}\n`
  writeFileSync(SAIDA, texto)
  console.log(`escrito ${SAIDA}: ${produtos.length} produtos, ${(texto.length / 1e6).toFixed(2)} MB`)
}

const lista = await fazerLista()
if (fase === 'lista') {
  escrever(lista, null)
} else {
  const fichas = await fazerFichas(lista)
  if (fase === 'tudo') escrever(lista, fichas)
}
