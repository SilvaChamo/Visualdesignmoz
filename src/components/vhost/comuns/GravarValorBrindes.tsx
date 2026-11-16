'use client'

// Calculadora › «Custos da remessa»: o valor dos brindes do site vem daqui. Ao abrir, lê o que está guardado e volta a pôr os valores nos campos; e sempre
// que se clica em «Guardar» (depois de alterar custos da remessa, margens, direitos, imposto), grava a configuração que o catálogo /brindes usa, ou, com uma
// encomenda carregada, aplica os valores à encomenda e às suas cotações. Sem nada guardado, o catálogo mostra só o câmbio com a margem e o IVA da calculadora.

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { translate } from '../i18n'
import type { ConfigBrindes } from '@/lib/preco-brindes'

const NOTA = 'text-xs leading-relaxed text-slate-500 dark:text-slate-400'

export function GravarValorBrindes({ config, aoCarregar, aoLer, encomendaCarregada, aoAplicar }: { config: ConfigBrindes | null; aoCarregar: (campos: Record<string, string>) => void; aoLer?: () => void; encomendaCarregada: boolean; aoAplicar: () => void }) {
  const { lang } = useI18n()
  const tr = (k: string) => translate(lang, k)
  const [estado, setEstado] = useState('')

  useEffect(() => {
    fetch('/api/admin/brindes-estimativa/custos', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const c = j.success ? (j.calculo as ConfigBrindes | null) : null
        if (c?.campos) aoCarregar(c.campos)
        aoLer?.()
      })
      .catch(() => {
        setEstado(tr('Não foi possível ler os custos da remessa.'))
        aoLer?.()
      })
    // só ao abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // «Guardar»: com a lista própria, grava a configuração que o catálogo /brindes usa; com uma encomenda carregada, aplica os custos aos valores dessa encomenda
  const guardar = async () => {
    if (encomendaCarregada) {
      aoAplicar()
      setEstado(tr('Guardado: os valores da encomenda e das suas cotações foram actualizados.'))
      return
    }
    if (!config) {
      setEstado(tr('Não foi possível guardar os custos da remessa.'))
      return
    }
    try {
      const r = await fetch('/api/admin/brindes-estimativa/custos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
      const j = await r.json()
      setEstado(j.success ? tr('Guardado: já conta no valor dos brindes.') : j.error || tr('Não foi possível guardar os custos da remessa.'))
    } catch {
      setEstado(tr('Não foi possível guardar os custos da remessa.'))
    }
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={guardar} className="inline-flex cursor-pointer items-center rounded-[5px] bg-red-600 px-4 py-1.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700">
        {tr('Guardar')}
      </button>
      <p className={`${NOTA} mt-2`}>
        {tr('Depois de alterar os valores desta secção, as margens, os direitos e o imposto, clique em Guardar: com a lista própria, o valor dos brindes do site e das novas cotações passa a ser este (cada produto leva a sua parte do transporte, da alfândega e das outras despesas, repartida pelo valor); com uma encomenda carregada, os valores dessa encomenda e das suas cotações são actualizados. A alfândega indicada em valor total substitui a taxa de direitos.')}{' '}
        <span role="status">{estado}</span>
      </p>
    </div>
  )
}
