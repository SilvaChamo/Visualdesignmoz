import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { ProdutoDetalhe } from '@/components/brindes/ProdutoDetalhe'
import { InformacaoProduto } from '@/components/brindes/InformacaoProduto'
import { SeccaoProdutos } from '@/components/brindes/SeccaoProdutos'
import { ATUALIZADO_EM, emMt, produtoPorSlug, relacionados } from '@/lib/catalogo-brindes'
import { cambioZarMzn } from '@/lib/cambio-brindes'
import { fichaDoProduto } from '@/lib/catalogo-fichas'
import { urlImagem } from '@/lib/catalogo-imagens'
import { hrefGrupo } from '@/lib/catalogo-grupos'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const achado = produtoPorSlug(slug)
  if (!achado) return {}
  const { produto, sub } = achado
  const titulo = `${produto.nome}${produto.marca ? ` — ${produto.marca}` : ''} | VisualGifts`
  const descricao = `${produto.nome}${sub ? ` (${sub.nome})` : ''}: veja as cores, os tamanhos, o stock e as formas de personalizar com o logótipo da sua empresa. Cotação em Moçambique com a VisualDesign.`
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: `/brindes/produto/${produto.slug}` },
    openGraph: { title: titulo, description: descricao, type: 'website', siteName: 'VisualDesign', locale: 'pt_MZ', images: [{ url: urlImagem(produto.imagem, 900) }] },
  }
}

export default async function ProdutoPage({ params }: Props) {
  const { slug } = await params
  const achado = produtoPorSlug(slug)
  if (!achado) notFound()
  const { produto, imagens, grupo, sub } = achado

  const lido = await fichaDoProduto(produto.sku)
  const taxa = await cambioZarMzn()
  const rel = relacionados(produto.sku, 8)
  const [comPreco] = emMt([produto], taxa)

  const migalhas: { nome: string; href: string }[] = [
    { nome: 'Início', href: '/' },
    { nome: 'VisualGifts', href: '/brindes' },
    ...(grupo ? [{ nome: grupo.nome, href: hrefGrupo(grupo) }] : []),
    ...(grupo && sub ? [{ nome: sub.nome, href: hrefGrupo(grupo, sub) }] : []),
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: produto.nome,
    sku: produto.sku,
    ...(produto.marca ? { brand: { '@type': 'Brand', name: produto.marca } } : {}),
    image: [urlImagem(produto.imagem, 900)],
    ...(lido?.ficha.mat ? { material: lido.ficha.mat } : {}),
  }

  return (
    <div className="min-h-screen bg-black/10 dark:bg-black">
      <div className="bg-zinc-50 dark:bg-zinc-950">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
        <div className="container mx-auto max-w-7xl px-4 pb-28 pt-[140px] sm:px-6 sm:pt-[160px]">
          <nav aria-label="Caminho" className="mb-6 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 sm:text-sm">
            {migalhas.map((m) => (
              <span key={m.href} className="flex items-center gap-1.5">
                <Link href={m.href} className="transition-colors hover:text-red-600">
                  {m.nome}
                </Link>
                <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              </span>
            ))}
            <span className="max-w-[60vw] truncate text-zinc-900 dark:text-zinc-100">{produto.nome}</span>
          </nav>

          <ProdutoDetalhe produto={{ ...comPreco, imagens }} ficha={lido?.ficha ?? null} />

          <div className="mt-14">
            <InformacaoProduto
              sku={produto.sku}
              ficha={lido?.ficha ?? null}
              atualizadoEm={lido?.atualizadoEm ?? ATUALIZADO_EM}
              resumo={{ marca: produto.marca, gama: sub?.nome ?? null, grupoNome: grupo?.nome ?? null, ideal: grupo?.ideal ?? [] }}
            />
          </div>

          <div className="mt-6">
            <SeccaoProdutos antetitulo={grupo?.nome} titulo={sub ? <><span>Mais</span> <span>{sub.nome}</span></> : 'Mais produtos'} texto="Outros produtos parecidos, para comparar." produtos={emMt(rel.daSub, taxa)} href={grupo && sub ? hrefGrupo(grupo, sub) : undefined} rotulo="Ver todos" />
            <SeccaoProdutos antetitulo="Explore mais" titulo={grupo ? <><span>Mais em</span> <span>{grupo.nome}</span></> : 'Mais produtos'} texto="Combine com outros artigos da mesma gama." produtos={emMt(rel.doGrupo, taxa)} href={grupo ? hrefGrupo(grupo) : '/brindes#catalogo'} rotulo="Ver todos" />
            {produto.marca && <SeccaoProdutos antetitulo="Da mesma marca" titulo={<><span>Mais</span> <span>{produto.marca}</span></>} produtos={emMt(rel.daMarca, taxa)} href={`/brindes?marca=${encodeURIComponent(produto.marca)}#catalogo`} rotulo="Ver todos" />}
          </div>
        </div>
      </div>
    </div>
  )
}
