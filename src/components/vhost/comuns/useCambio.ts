'use client'

// Lê o câmbio do dia (/api/vhost/cambio) para a calculadora. A última leitura fica guardada neste navegador: ao abrir, a calculadora
// já tem câmbio e actualiza-o por trás; se a rota falhar, continua com o último guardado e diz de que dia é.

import { useCallback, useEffect, useState } from 'react'
import { FUNDO } from '../carga'
import type { CambioDoDia } from '@/lib/cambio'

const CHAVE = 'vh-cambio-1'

/** 'a-ler' à espera da primeira resposta · 'ok' acabou de vir do servidor · 'erro' o servidor não respondeu (pode haver o último guardado) */
export type EstadoCambio = 'a-ler' | 'ok' | 'erro'

function valido(x: unknown): x is CambioDoDia {
  const t = (x as CambioDoDia | null)?.taxas
  return !!t && typeof t === 'object' && typeof t.MZN === 'number' && t.MZN > 0
}

// a página pode montar-se duas vezes ao abrir: um só pedido de cada vez
let aLer: Promise<CambioDoDia> | null = null

function pedir(): Promise<CambioDoDia> {
  aLer ??= fetch('/api/vhost/cambio', { cache: 'no-store', headers: FUNDO })
    .then(async (r) => {
      const j: unknown = await r.json().catch(() => null)
      if (!r.ok || !valido(j)) throw new Error('sem câmbio')
      return j
    })
    .finally(() => {
      aLer = null
    })
  return aLer
}

export function useCambio() {
  const [dados, setDados] = useState<CambioDoDia | null>(null)
  const [estado, setEstado] = useState<EstadoCambio>('a-ler')

  const ler = useCallback(async () => {
    setEstado((e) => (e === 'ok' ? e : 'a-ler'))
    try {
      const j = await pedir()
      setDados(j)
      setEstado(j.desatualizado ? 'erro' : 'ok')
      try {
        localStorage.setItem(CHAVE, JSON.stringify(j))
      } catch {}
    } catch {
      setEstado('erro')
    }
  }, [])

  useEffect(() => {
    try {
      const g: unknown = JSON.parse(localStorage.getItem(CHAVE) || 'null')
      if (valido(g)) setDados(g)
    } catch {}
    void ler()
  }, [ler])

  return { dados, estado, ler }
}
