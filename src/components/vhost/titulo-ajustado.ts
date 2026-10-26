'use client';

// Título e descrição da barra de cima nunca cortados com "…" (pedido do Silva, 13/10/2026: "não pode fechar dados,
// reduzir sempre"). Quando não cabem, primeiro os botões da barra dão lugar (pedido do Silva, 13/10/2026: o botão não
// fica do mesmo tamanho a tocar nas letras): encolhem e, se ainda tocarem, ficam só com o ícone; depois a letra diminui
// até caber; se nem no mínimo couber, o título passa à linha de baixo e a descrição sai (nunca em duas linhas — Silva,
// 13/10/2026). Corre ao mudar de página e ao mudar o tamanho da janela.
import { useEffect, useLayoutEffect } from 'react';

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** [id do elemento, letra mínima em px] */
const ALVOS: [string, number][] = [
  ['ptitle', 12],
  ['pdesc', 9.5],
];

/** passos dos botões da barra de cima, por ordem: mais pequenos; só o ícone */
const PASSOS = ['acoes-menores', 'acoes-so-icone'];

/** o texto passa da caixa? Medido ao píxel (Range): o scrollWidth arredonda e o "…" aparece logo com uma fração a mais */
function transborda(el: HTMLElement) {
  if (el.scrollWidth > el.clientWidth) return true;
  const cs = getComputedStyle(el);
  const livre =
    el.getBoundingClientRect().width -
    ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((s, k) => s + (parseFloat(cs[k as 'paddingLeft']) || 0), 0);
  const texto = document.createRange();
  texto.selectNodeContents(el);
  return texto.getBoundingClientRect().width > livre + 0.05;
}

function ajustar() {
  const els = ALVOS.map(([id]) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
  for (const el of els) {
    el.style.fontSize = '';
    el.style.whiteSpace = '';
    el.style.textOverflow = '';
    el.style.overflowWrap = '';
    el.style.display = '';
  }
  const topo = document.querySelector<HTMLElement>('.vh header.top');
  if (topo) {
    topo.classList.remove(...PASSOS);
    for (const passo of PASSOS) {
      if (!els.some(transborda)) break;
      topo.classList.add(passo);
    }
  }
  for (const [id, minimo] of ALVOS) {
    const el = document.getElementById(id);
    if (!el) continue;
    let tam = parseFloat(getComputedStyle(el).fontSize) || 14;
    while (transborda(el) && tam > minimo) {
      tam = Math.max(minimo, tam - 0.5);
      el.style.fontSize = tam + 'px';
    }
    if (transborda(el)) {
      if (id === 'pdesc') el.style.display = 'none';
      else {
        el.style.whiteSpace = 'normal';
        el.style.textOverflow = 'clip';
        // um domínio comprido não tem espaços: sem isto a linha de baixo nunca chegava a existir e o fim ficava cortado
        el.style.overflowWrap = 'anywhere';
      }
    }
  }
}

/** Faixa por baixo da barra de cima (título da página ou Widgets | Menu à esquerda, domínio à direita): tudo numa só
 *  linha, cada um no seu canto, a pouca distância um do outro (Silva, 14/10/2026: "gestao.entrecamposblog.co.mz"
 *  passava a duas linhas). Se não couber: a letra do domínio diminui; depois Widgets | Menu ficam só com o ícone; depois
 *  o globo do domínio sai (Silva, 14/10/2026: "quando o ícone tocar no limite, desaparecer"); depois o domínio e o
 *  título diminuem mais; só se nem no mínimo couberem passam à linha de baixo. */
/** largura real do texto (Range), não a da caixa */
function caixaTexto(el: Element) {
  const r = document.createRange();
  r.selectNodeContents(el);
  return r.getBoundingClientRect();
}

function ajustarFaixas() {
  for (const faixa of document.querySelectorAll<HTMLElement>('.vh main .da-switcher-bar')) {
    const dom = faixa.querySelector<HTMLElement>('.dom-btn span:not(.chevs)');
    const sel = faixa.querySelector<HTMLElement>('.da-domain-selector');
    // o nome da página só conta se estiver à vista (no telemóvel a faixa mostra só a casa)
    const titEl = faixa.querySelector<HTMLElement>('.da-breadcrumb>span:last-child');
    const tit = titEl && titEl.getClientRects().length ? titEl : null;
    const esq = faixa.querySelector<HTMLElement>('.da-breadcrumb, .da-switcher-tabs');
    if (!dom || !sel) continue;
    faixa.classList.remove('faixa-so-icone', 'faixa-sem-globo');
    for (const el of [dom, titEl]) if (el) (el.style.fontSize = ''), (el.style.whiteSpace = ''), (el.style.textWrap = '');
    if (esq) esq.style.flex = '';
    const direita = () => faixa.getBoundingClientRect().right - (parseFloat(getComputedStyle(faixa).paddingRight) || 0);
    // não cabe: algum texto sai da sua caixa, o título (ou Widgets | Menu) chega a menos de 6 px do domínio, ou o domínio
    // passa da margem da direita
    const passa = () => {
      const s = sel.getBoundingClientRect();
      const fimEsq = tit ? caixaTexto(tit).right : esq ? esq.getBoundingClientRect().right : 0;
      // (o <wbr> deixa o navegador partir o domínio mesmo com nowrap: duas linhas também é "não cabe")
      const duasLinhas = (el: HTMLElement) => caixaTexto(el).height > (parseFloat(getComputedStyle(el).fontSize) || 13) * 1.6;
      return transborda(dom) || duasLinhas(dom) || (!!tit && (transborda(tit) || duasLinhas(tit))) || fimEsq > s.left - 6 + 0.5 || caixaTexto(dom).right > s.right + 0.5 || s.right > direita() + 0.5;
    };
    const diminuir = (el: HTMLElement | null, minimo: number) => {
      if (!el) return;
      let tam = parseFloat(getComputedStyle(el).fontSize) || 13;
      while (passa() && tam > minimo) {
        tam = Math.max(minimo, tam - 0.5);
        el.style.fontSize = tam + 'px';
      }
    };
    diminuir(dom, 11);
    if (passa() && faixa.querySelector('.da-switcher-tabs')) {
      // com os separadores só com o ícone sobra espaço: o domínio volta ao tamanho normal e só diminui o que for preciso
      faixa.classList.add('faixa-so-icone');
      dom.style.fontSize = '';
      diminuir(dom, 11);
    }
    diminuir(dom, 10);
    if (passa()) {
      // caso extremo: o globo do domínio sai
      faixa.classList.add('faixa-sem-globo');
      dom.style.fontSize = '';
      diminuir(dom, 10);
    }
    diminuir(dom, 9.5);
    diminuir(tit, 10);
    if (passa()) {
      // nem no mínimo cabe: o título fica inteiro (no tamanho normal) e o domínio passa a duas linhas iguais, encostadas
      // à direita e partidas em qualquer letra (Silva, 14/10/2026) — sem uma letra sozinha na linha de baixo
      if (esq) esq.style.flex = '0 0 auto';
      if (tit) tit.style.fontSize = '';
      dom.style.fontSize = '';
      dom.style.whiteSpace = 'normal';
      dom.style.textWrap = 'balance';
      let tam = parseFloat(getComputedStyle(dom).fontSize) || 11;
      while (caixaTexto(dom).height > tam * 1.15 * 2.5 && tam > 9.5) {
        tam -= 0.5;
        dom.style.fontSize = tam + 'px';
      }
    }
  }
}

export function useTituloAjustado(chave: unknown) {
  useIso(() => {
    const tudo = () => {
      ajustar();
      ajustarFaixas();
    };
    tudo();
    // as letras do site podem chegar depois do primeiro desenho
    const t = setTimeout(tudo, 300);
    window.addEventListener('resize', tudo);
    // a descrição pode crescer depois (ex.: "| 17 tentativas em 24 h" chega com os dados): volta a ajustar
    let quadro = 0;
    const mudou = new MutationObserver(() => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(tudo);
    });
    const topo = document.querySelector('.vh header.top');
    if (topo) mudou.observe(topo, { childList: true, characterData: true, subtree: true });
    // ao escolher outro domínio no seletor, o texto da faixa muda
    for (const faixa of document.querySelectorAll('.vh main .da-switcher-bar')) mudou.observe(faixa, { childList: true, characterData: true, subtree: true });
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(quadro);
      mudou.disconnect();
      window.removeEventListener('resize', tudo);
    };
  }, [chave]);
}
