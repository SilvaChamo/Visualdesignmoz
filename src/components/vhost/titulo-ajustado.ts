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
      }
    }
  }
}

export function useTituloAjustado(chave: unknown) {
  useIso(() => {
    ajustar();
    // as letras do site podem chegar depois do primeiro desenho
    const t = setTimeout(ajustar, 300);
    window.addEventListener('resize', ajustar);
    // a descrição pode crescer depois (ex.: "| 17 tentativas em 24 h" chega com os dados): volta a ajustar
    let quadro = 0;
    const mudou = new MutationObserver(() => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(ajustar);
    });
    const topo = document.querySelector('.vh header.top');
    if (topo) mudou.observe(topo, { childList: true, characterData: true, subtree: true });
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(quadro);
      mudou.disconnect();
      window.removeEventListener('resize', ajustar);
    };
  }, [chave]);
}
