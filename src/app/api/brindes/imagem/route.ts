// Imagens do catálogo de brindes (VisualGifts), servidas pelo próprio site.
//
// O otimizador do Next.js desiste ao fim de 7 s se a origem demora (e a do fornecedor demora, sobretudo com muitas
// imagens ao mesmo tempo): as fotos ficavam em branco (erro 504). Aqui a origem tem tempo e novas tentativas, no máximo
// SIMULTANEAS pedidos de cada vez (para não abusar do fornecedor), a imagem é reduzida à largura pedida e fica guardada
// em disco: da segunda vez em diante responde logo e o navegador guarda-a um ano.
// Só serve ficheiros de ProductImages/<pasta>/<ficheiro>.(jpg|png|webp) e larguras da lista.

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

export const runtime = 'nodejs'

const ORIGEM = 'https://amrcdn.amrod.co.za/amrodprod-blob/ProductImages/'
const PASTA = join(tmpdir(), 'visualdesign-brindes-imagens')
const LARGURAS = new Set([96, 160, 320, 480, 640, 900, 1200])
const CAMINHO = /^[\w.\- ()%+&,]+\/[\w.\- ()%+&,]+\.(?:jpe?g|png|webp)$/i
const SIMULTANEAS = 6
const MAX_ORIGEM = 12 * 1024 * 1024

const SEM_IMAGEM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="#f4f4f5"/><g fill="none" stroke="#a1a1aa" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="44" y="52" width="72" height="56" rx="6"/><circle cx="64" cy="70" r="6"/><path d="M44 98l22-20 18 16 12-10 20 18"/></g></svg>`

// pedidos à origem: no máximo SIMULTANEAS ao mesmo tempo, os outros esperam a vez
let ativos = 0
const fila: (() => void)[] = []
async function comVez<T>(tarefa: () => Promise<T>): Promise<T> {
  if (ativos >= SIMULTANEAS) await new Promise<void>((r) => fila.push(r))
  ativos++
  try {
    return await tarefa()
  } finally {
    ativos--
    fila.shift()?.()
  }
}

async function buscarOrigem(caminho: string): Promise<Buffer> {
  let erro: unknown
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const r = await fetch(ORIGEM + caminho.split('/').map(encodeURIComponent).join('/'), { signal: AbortSignal.timeout(30000), headers: { accept: 'image/*' } })
      if (!r.ok) throw new Error(`origem ${r.status}`)
      const b = Buffer.from(await r.arrayBuffer())
      if (b.length > MAX_ORIGEM) throw new Error('imagem demasiado grande')
      return b
    } catch (e) {
      erro = e
      if (String(e).includes('origem 404')) break
    }
  }
  throw erro
}

// a mesma imagem pedida várias vezes ao mesmo tempo é feita uma só vez
const emCurso = new Map<string, Promise<Buffer>>()

async function imagem(caminho: string, largura: number): Promise<Buffer> {
  const ficheiro = join(PASTA, createHash('sha1').update(`${caminho}|${largura}`).digest('hex') + '.webp')
  try {
    return await readFile(ficheiro)
  } catch {
    /* ainda não está em disco */
  }
  let p = emCurso.get(ficheiro)
  if (!p) {
    p = comVez(async () => {
      const origem = await buscarOrigem(caminho)
      const saida = await sharp(origem).rotate().resize({ width: largura, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
      await mkdir(PASTA, { recursive: true })
      await writeFile(ficheiro, saida).catch(() => {})
      return saida
    }).finally(() => emCurso.delete(ficheiro))
    emCurso.set(ficheiro, p)
  }
  return p
}

export async function GET(req: Request) {
  const u = new URL(req.url)
  const caminho = (u.searchParams.get('p') ?? '').replace(/^ProductImages\//, '')
  const largura = Number(u.searchParams.get('w') ?? 480)
  if (!CAMINHO.test(caminho) || caminho.includes('..') || !LARGURAS.has(largura)) return new Response('pedido inválido', { status: 400 })
  try {
    const b = await imagem(caminho, largura)
    return new Response(new Uint8Array(b), { headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=31536000, immutable' } })
  } catch {
    // sem imagem (origem em baixo ou ficheiro que não existe): um quadro neutro, sem guardar na cache do navegador
    return new Response(SEM_IMAGEM, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=60' } })
  }
}
