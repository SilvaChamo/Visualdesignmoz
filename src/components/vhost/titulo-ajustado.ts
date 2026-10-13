'use client';

// Título e descrição da barra de cima nunca cortados com "…" (pedido do Silva, 13/10/2026: "não pode fechar dados,
// reduzir sempre"): quando não cabem, a letra diminui até caber; se nem no mínimo couber, a descrição passa à linha
// de baixo. Corre ao mudar de página e ao mudar o tamanho da janela.
import { useEffect, useLayoutEffect } from 'react';

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** [id do elemento, letra mínima em px] */
const ALVOS: [string, number][] = [
  ['ptitle', 12],
  ['pdesc', 9.5],
];

function ajustar() {
  for (const [id, minimo] of ALVOS) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.style.fontSize = '';
    el.style.whiteSpace = '';
    el.style.textOverflow = '';
    let tam = parseFloat(getComputedStyle(el).fontSize) || 14;
    while (el.scrollWidth > el.clientWidth + 1 && tam > minimo) {
      tam = Math.max(minimo, tam - 0.5);
      el.style.fontSize = tam + 'px';
    }
    if (el.scrollWidth > el.clientWidth + 1) {
      el.style.whiteSpace = 'normal';
      el.style.textOverflow = 'clip';
    }
  }
}

export function useTituloAjustado(chave: unknown) {
  useIso(() => {
    ajustar();
    // as letras do site podem chegar depois do primeiro desenho
    const t = setTimeout(ajustar, 300);
    window.addEventListener('resize', ajustar);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', ajustar);
    };
  }, [chave]);
}
