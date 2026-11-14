'use client'

// Calculadora › «Valor dos brindes no site»: as percentagens que o catálogo /brindes usa para mostrar o valor estimado por unidade
// (preço do fornecedor cambiado + margem de falha + transporte + direitos, ÷ (1 − margem), + IVA). Ao guardar, mudam o valor de todos os
// produtos do catálogo (em menos de um minuto). O câmbio rand → metical é automático (o mesmo do dia que a calculadora usa).

import { useEffect, useState } from 'react'

const CAMPO =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
const ROTULO = 'mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400'

const CAMPOS = [
  ['erroPct', 'Margem de falha (%)'],
  ['transportePct', 'Transporte até Maputo (%)'],
  ['direitosPct', 'Direitos aduaneiros (%)'],
  ['margemPct', 'Margem bruta pretendida (%)'],
  ['ivaPct', 'IVA (%)'],
] as const

type Chave = (typeof CAMPOS)[number][0]
type Valores = Record<Chave, string>

const paraTexto = (v: Record<Chave, number>): Valores => Object.fromEntries(CAMPOS.map(([k]) => [k, String(v[k])])) as Valores

export function CartaoBrindesEstimativa() {
  const [v, setV] = useState<Valores | null>(null)
  const [padrao, setPadrao] = useState<Valores | null>(null)
  const [estado, setEstado] = useState('')
  const [aGuardar, setAGuardar] = useState(false)

  useEffect(() => {
    fetch('/api/admin/brindes-estimativa', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return setEstado(j.error || 'Não foi possível ler os valores.')
        setV(paraTexto(j.valores))
        setPadrao(paraTexto(j.padrao))
      })
      .catch(() => setEstado('Não foi possível ler os valores.'))
  }, [])

  async function guardar() {
    if (!v) return
    setAGuardar(true)
    setEstado('')
    try {
      const r = await fetch('/api/admin/brindes-estimativa', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) })
      const j = await r.json()
      setEstado(j.success ? 'Guardado. O valor dos brindes no site muda em menos de um minuto.' : j.error || 'Não foi possível guardar.')
    } catch {
      setEstado('Não foi possível guardar.')
    } finally {
      setAGuardar(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 @xl:p-6">
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Valor dos brindes no site</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Estas percentagens dão o valor estimado por unidade que o catálogo de brindes mostra: preço do fornecedor cambiado, com a margem de falha, o transporte e os direitos, dividido por (1 − margem), mais o IVA. A impressão fica de fora (especifica-se na cotação). O câmbio do rand é automático, o do dia.
      </p>
      {v ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 @xl:grid-cols-3">
            {CAMPOS.map(([k, rotulo]) => (
              <div key={k}>
                <label htmlFor={`cbe-${k}`} className={ROTULO}>
                  {rotulo}
                </label>
                <input id={`cbe-${k}`} type="number" inputMode="decimal" min={0} step="any" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className={CAMPO} />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" disabled={aGuardar} onClick={guardar} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60">
              Guardar
            </button>
            {padrao && (
              <button type="button" onClick={() => setV(padrao)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-red-500 hover:text-red-600 dark:border-slate-700 dark:text-slate-300">
                Repor os valores de partida
              </button>
            )}
            <span role="status" className="text-xs text-slate-500 dark:text-slate-400">
              {estado}
            </span>
          </div>
        </>
      ) : (
        <p role="status" className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          {estado || 'A carregar…'}
        </p>
      )}
    </div>
  )
}
