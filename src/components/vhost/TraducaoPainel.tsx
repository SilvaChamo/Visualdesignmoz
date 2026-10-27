'use client';

// Rede de segurança da tradução do painel (Silva, 27/10/2026: «tem muitas páginas não traduzidas no painel… espero que não
// tenha nenhuma página fora da tradução»). As páginas traduzem o que passa por `t()`; este componente aplica o mesmo
// dicionário (`translate`, src/components/vhost/i18n.ts) a todo o texto que chega ao ecrã dentro do painel (`.vh`) — também
// os componentes que vieram dos painéis antigos (comuns/…), os que abrem depois (janelas, listas vindas do servidor) e os
// atributos placeholder/title/alt/aria-label. Voltar ao português repõe os textos originais. Quem não tem linha no
// dicionário fica em português: `npm run i18n:painel` lista o que falta. Zonas que não se traduzem: `data-sem-traducao`.
import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { translate } from './i18n';

// Em segundo lugar, o dicionário do site público (src/lib/i18n-textos.ts): serve os componentes partilhados com o site (checkout, cotações…)
type Publico = { fixos: Map<string, string>; modelos: { re: RegExp; en: string }[] };
const normal = (x: string) => x.replace(/\s+/g, ' ').trim();
let publico: Promise<Publico> | null = null;
function carregarPublico(): Promise<Publico> {
  publico ??= import('@/lib/i18n-textos').then(({ EN }) => {
    const fixos = new Map<string, string>();
    const modelos: Publico['modelos'] = [];
    for (const [pt, en] of Object.entries(EN as Record<string, string>)) {
      const k = normal(pt);
      if (!/\{\d\}/.test(k)) fixos.set(k, en);
      else modelos.push({ re: new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\d)\\?\}/g, '(?<v$1>.+?)') + '$'), en });
    }
    return { fixos, modelos };
  });
  return publico;
}
function doPublico(d: Publico, original: string): string {
  const k = normal(original);
  let en = d.fixos.get(k);
  if (en === undefined) {
    for (const m of d.modelos) {
      const r = m.re.exec(k);
      if (r) {
        en = m.en.replace(/\{(\d)\}/g, (_x, i) => r.groups?.['v' + i] ?? '');
        break;
      }
    }
  }
  if (en === undefined) return original;
  return (original.match(/^\s*/)?.[0] ?? '') + en + (original.match(/\s*$/)?.[0] ?? '');
}

const ATRIBUTOS = ['placeholder', 'title', 'alt', 'aria-label'] as const;
const IGNORAR = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'svg']);
const DENTRO = '.vh, [data-vh-portal]';
const FORA = '[data-sem-traducao], [contenteditable="true"], .ql-editor, .cm-editor';

/** o elemento está no painel e fora das zonas que não se traduzem */
function noPainel(el: Element | null): boolean {
  return !!el && !!el.closest(DENTRO) && !el.closest(FORA);
}
/** o texto de um elemento (não o de código, caixas de texto nem desenhos) */
function dentroDoPainel(el: Element | null): boolean {
  return !!el && !IGNORAR.has(el.tagName) && !el.closest('svg') && noPainel(el);
}

export function TraducaoPainel() {
  const { lang } = useI18n();

  useEffect(() => {
    if (lang !== 'en') return;
    let vivo = true;
    let dic: Publico | null = null;
    const trad = (x: string) => {
      const r = translate('en', x);
      return r !== x || !dic ? r : doPublico(dic, x);
    };
    // o que foi trocado: para repor o português e para não voltar a traduzir o próprio inglês
    const textos = new Map<Text, { pt: string; en: string }>();
    const atributos = new Map<Element, Map<string, { pt: string; en: string }>>();

    const noTexto = (n: Text) => {
      const atual = n.nodeValue || '';
      const feito = textos.get(n);
      if (feito && atual === feito.en) return;
      if (!dentroDoPainel(n.parentElement)) return;
      const en = trad(atual);
      if (en === atual) {
        if (feito) textos.delete(n);
        return;
      }
      textos.set(n, { pt: atual, en });
      n.nodeValue = en;
    };
    const noAtributo = (el: Element, a: string) => {
      const atual = el.getAttribute(a);
      if (atual == null) return;
      const feitos = atributos.get(el);
      if (feitos?.get(a)?.en === atual) return;
      if (!noPainel(el)) return;
      const en = trad(atual);
      if (en === atual) return;
      const m = feitos || new Map();
      m.set(a, { pt: atual, en });
      atributos.set(el, m);
      el.setAttribute(a, en);
    };
    const percorrer = (raiz: Node) => {
      if (raiz.nodeType === Node.TEXT_NODE) return noTexto(raiz as Text);
      if (raiz.nodeType !== Node.ELEMENT_NODE) return;
      const el = raiz as Element;
      if (el.closest(FORA)) return;
      for (const a of ATRIBUTOS) if (el.hasAttribute(a)) noAtributo(el, a);
      const w = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.nodeType === Node.ELEMENT_NODE && (n as Element).matches(FORA) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (n.nodeType === Node.TEXT_NODE) noTexto(n as Text);
        else for (const a of ATRIBUTOS) if ((n as Element).hasAttribute(a)) noAtributo(n as Element, a);
      }
    };

    document.querySelectorAll(DENTRO).forEach(percorrer);
    carregarPublico().then((d) => {
      if (!vivo) return;
      dic = d;
      document.querySelectorAll(DENTRO).forEach(percorrer);
    });
    const observador = new MutationObserver((mudancas) => {
      for (const m of mudancas) {
        if (m.type === 'characterData') noTexto(m.target as Text);
        else if (m.type === 'attributes' && m.attributeName) noAtributo(m.target as Element, m.attributeName);
        else m.addedNodes.forEach(percorrer);
      }
    });
    observador.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATRIBUTOS] });

    return () => {
      vivo = false;
      observador.disconnect();
      // de volta ao português: repõe só o que continua com o inglês que se pôs (o resto o React já mudou)
      textos.forEach((v, n) => {
        if (n.isConnected && n.nodeValue === v.en) n.nodeValue = v.pt;
      });
      atributos.forEach((m, el) => {
        m.forEach((v, a) => {
          if (el.isConnected && el.getAttribute(a) === v.en) el.setAttribute(a, v.pt);
        });
      });
    };
  }, [lang]);

  return null;
}
