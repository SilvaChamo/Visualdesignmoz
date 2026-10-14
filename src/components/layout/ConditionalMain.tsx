'use client'

/**
 * O <main> normal ocupa sempre pelo menos o ecrã inteiro (min-h-screen), para
 * páginas curtas não deixarem o rodapé a meio do ecrã. Mas as páginas em modo
 * ?embed=1 (ex.: /cotacao dentro de um iframe no painel de encomendas) contam
 * com o documento ter exactamente a altura do próprio conteúdo — é assim que
 * o iframe que as mostra sabe a que altura crescer. Um min-h-screen aqui
 * criava um "chão" à força do tamanho do ecrã, impedindo o iframe de encolher
 * para facturas curtas (via ResizeObserver, ver EncomendaDetalhe.tsx). Com ?embed=1 o min-h-screen é anulado por
 * EmbedEstilo.tsx (lido numa fronteira <Suspense> própria, para a página continuar a vir desenhada do servidor).
 */
export function ConditionalMain({ children }: { children: React.ReactNode }) {
  return (
    <main className="site-content bg-background text-foreground min-h-screen">
      {children}
    </main>
  )
}
