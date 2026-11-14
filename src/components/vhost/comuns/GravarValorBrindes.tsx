'use client'

// Calculadora › «Custos da remessa»: o valor dos brindes do site vem daqui. Ao abrir, lê o que está guardado e volta a pôr os valores nos campos; e sempre
// que se altera um valor (custos da remessa, margens, direitos, imposto), grava sozinho, um instante depois, a configuração que o catálogo /brindes usa.
// Sem nada guardado, o catálogo mostra só o câmbio com a margem e o IVA da calculadora; só uma alteração faz gravar (abrir a calculadora não grava nada).

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { translate } from '../i18n'
import type { ConfigBrindes } from '@/lib/preco-brindes'

const NOTA = 'text-xs leading-relaxed text-slate-500 dark:text-slate-400'

export function GravarValorBrindes({ config, aoCarregar }: { config: ConfigBrindes | null; aoCarregar: (campos: Record<string, string>) => void }) {
  const { lang } = useI18n()
  const tr = (k: string) => translate(lang, k)
  const [estado, setEstado] = useState('')
  // null enquanto não se sabe o que está guardado; depois, o texto da última configuração guardada (ou a primeira calculada, se não havia nenhuma)
  const ultimo = useRef<string | null>(null)
  const semGuardado = useRef(false)

  useEffect(() => {
    fetch('/api/admin/brindes-estimativa/custos', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const c = j.success ? (j.calculo as ConfigBrindes | null) : null
        if (c) {
          ultimo.current = JSON.stringify(c)
          if (c.campos) aoCarregar(c.campos)
        } else {
          semGuardado.current = true
        }
      })
      .catch(() => setEstado(tr('Não foi possível ler os custos da remessa.')))
    // só ao abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chave = config ? JSON.stringify(config) : null
  useEffect(() => {
    if (!config || !chave) return
    if (ultimo.current === null) {
      if (semGuardado.current) ultimo.current = chave
      return
    }
    if (chave === ultimo.current) return
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/admin/brindes-estimativa/custos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
        const j = await r.json()
        if (j.success) ultimo.current = chave
        setEstado(j.success ? tr('Guardado: já conta no valor dos brindes.') : j.error || tr('Não foi possível guardar os custos da remessa.'))
      } catch {
        setEstado(tr('Não foi possível guardar os custos da remessa.'))
      }
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  return (
    <p className={`${NOTA} mt-3`}>
      {tr('Os valores desta secção, as margens, os direitos e o imposto gravam-se sozinhos no valor dos brindes do site: cada produto leva a sua parte do transporte, da alfândega, do lucro e das outras despesas, repartida pelo valor. A alfândega e o lucro indicados em valor total substituem a taxa de direitos e a margem (%). Sem nenhum valor definido, o site mostra só o câmbio com a margem e o IVA.')}{' '}
      <span role="status">{estado}</span>
    </p>
  )
}
