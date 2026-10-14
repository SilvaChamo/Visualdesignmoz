'use client'

import { useSearchParams } from 'next/navigation'

/**
 * ?embed=1 (ex.: /cotacao/[id] dentro de um iframe no painel de encomendas): sem o cabeçalho e o rodapé do site e sem
 * a altura mínima do ecrã (o iframe cresce à medida do conteúdo — ver ConditionalMain). Lido aqui, numa fronteira
 * <Suspense> só dele (layout.tsx), para o resto da página continuar a vir já desenhado do servidor: antes o site
 * inteiro só aparecia depois do JavaScript carregar — a tela branca ao abrir ou trocar de página (Silva, 14/10/2026).
 */
export function EmbedEstilo() {
  const embed = useSearchParams()?.get('embed') === '1'
  if (!embed) return null
  return <style>{'[data-site-chrome]{display:none!important}main.site-content{min-height:0!important}'}</style>
}
