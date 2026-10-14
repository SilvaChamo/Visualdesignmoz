'use client'

// Tradução automática do site para inglês (Silva, 14/10/2026: "traduza tudo e … todo o próximo conteúdo seja
// automaticamente traduzido"). O site escreve-se em português; com o inglês escolhido, este componente troca na página
// cada texto (e placeholder/title/alt/aria-label) pela versão inglesa do dicionário `src/lib/i18n-textos.ts` — também o
// que aparece depois (menus que abrem, listas que chegam do servidor). Voltar ao português repõe os textos originais.
// Os textos que já usam `t('chave')` (src/lib/i18n.tsx) continuam a funcionar como antes. O painel (.vh) tem a sua
// própria tradução e fica de fora, tal como qualquer zona marcada com `data-sem-traducao`.
// Texto novo sem linha no dicionário fica em português: `node scripts/i18n-verificar.mjs` lista os que faltam.

import { useEffect } from 'react'
import { useI18n } from '@/lib/i18n'

const ATRIBUTOS = ['placeholder', 'title', 'alt', 'aria-label'] as const
const IGNORAR = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'svg'])
const FORA = '.vh, [data-sem-traducao], [contenteditable="true"]'

/** textos fixos e modelos com partes que mudam ("A partir de {0}" → "From {0}") */
type Dic = { fixos: Map<string, string>; modelos: { re: RegExp; en: string }[] }
const normal = (s: string) => s.replace(/\s+/g, ' ').trim()

let dicionario: Promise<Dic> | null = null
const avisados = new Set<string>()
function carregar(): Promise<Dic> {
  dicionario ??= import('@/lib/i18n-textos').then(({ EN, IGUAIS }) => {
    const fixos = new Map<string, string>()
    const modelos: Dic['modelos'] = []
    for (const [pt, en] of Object.entries(EN)) {
      const k = normal(pt)
      if (!/\{\d\}/.test(k)) fixos.set(k, en)
      else {
        const fonte = k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\d)\\?\}/g, '(?<v$1>.+?)')
        modelos.push({ re: new RegExp('^' + fonte + '$'), en })
      }
    }
    for (const k of IGUAIS) if (!fixos.has(normal(k))) fixos.set(normal(k), k)
    return { fixos, modelos }
  })
  return dicionario
}

/** a versão inglesa, mantendo os espaços à volta (o JSX deixa-os nos nós de texto) */
function traduzir(dic: Dic, original: string): string | null {
  const chave = normal(original)
  if (!chave) return null
  let en = dic.fixos.get(chave)
  if (en === undefined) {
    for (const m of dic.modelos) {
      const r = m.re.exec(chave)
      if (r) {
        en = m.en.replace(/\{(\d)\}/g, (_, i) => r.groups?.['v' + i] ?? '')
        break
      }
    }
  }
  if (en === undefined) return null
  const ini = original.match(/^\s*/)![0]
  const fim = original.match(/\s*$/)![0]
  return ini + en + fim
}

function foraDaTraducao(el: Element | null): boolean {
  if (!el) return true
  if (IGNORAR.has(el.tagName) || el.closest('svg')) return true
  return !!el.closest(FORA)
}

export function TraducaoAutomatica() {
  const { lang } = useI18n()

  useEffect(() => {
    if (lang !== 'en') return
    let vivo = true
    // o que foi trocado: para repor o português e para não voltar a traduzir o próprio inglês
    const textos = new Map<Text, { pt: string; en: string }>()
    const atributos = new Map<Element, Map<string, { pt: string; en: string }>>()
    let observador: MutationObserver | null = null

    carregar().then((dic) => {
      if (!vivo) return

      const noTexto = (n: Text) => {
        const atual = n.nodeValue || ''
        const feito = textos.get(n)
        if (feito && atual === feito.en) return
        if (foraDaTraducao(n.parentElement)) return
        const en = traduzir(dic, atual)
        if (en === null || en === atual) {
          if (feito) textos.delete(n)
          // em desenvolvimento, avisa do texto português que ficou sem linha no dicionário
          if (en === null && process.env.NODE_ENV !== 'production' && /[ãõçáéíóúâêô]/i.test(atual) && !avisados.has(normal(atual))) {
            avisados.add(normal(atual))
            console.warn('[tradução] falta em src/lib/i18n-textos.ts:', JSON.stringify(normal(atual)))
          }
          return
        }
        textos.set(n, { pt: atual, en })
        n.nodeValue = en
      }
      const noAtributo = (el: Element, a: string) => {
        const atual = el.getAttribute(a)
        if (atual == null) return
        const feitos = atributos.get(el)
        if (feitos?.get(a)?.en === atual) return
        if (foraDaTraducao(el)) return
        const en = traduzir(dic, atual)
        if (en === null || en === atual) return
        const m = feitos || new Map()
        m.set(a, { pt: atual, en })
        atributos.set(el, m)
        el.setAttribute(a, en)
      }
      const percorrer = (raiz: Node) => {
        if (raiz.nodeType === Node.TEXT_NODE) return noTexto(raiz as Text)
        if (raiz.nodeType !== Node.ELEMENT_NODE) return
        const el = raiz as Element
        if (foraDaTraducao(el)) return
        for (const a of ATRIBUTOS) if (el.hasAttribute(a)) noAtributo(el, a)
        const w = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
          acceptNode: (n) =>
            n.nodeType === Node.ELEMENT_NODE && foraDaTraducao(n as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
        })
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          if (n.nodeType === Node.TEXT_NODE) noTexto(n as Text)
          else for (const a of ATRIBUTOS) if ((n as Element).hasAttribute(a)) noAtributo(n as Element, a)
        }
      }

      percorrer(document.body)
      observador = new MutationObserver((mudancas) => {
        for (const m of mudancas) {
          if (m.type === 'characterData') noTexto(m.target as Text)
          else if (m.type === 'attributes' && m.attributeName) noAtributo(m.target as Element, m.attributeName)
          else m.addedNodes.forEach(percorrer)
        }
      })
      observador.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATRIBUTOS] })
    })

    return () => {
      vivo = false
      observador?.disconnect()
      // de volta ao português: repõe só o que continua com o inglês que se pôs (o resto o React já mudou)
      textos.forEach((v, n) => {
        if (n.isConnected && n.nodeValue === v.en) n.nodeValue = v.pt
      })
      atributos.forEach((m, el) => {
        m.forEach((v, a) => {
          if (el.isConnected && el.getAttribute(a) === v.en) el.setAttribute(a, v.pt)
        })
      })
    }
  }, [lang])

  return null
}
