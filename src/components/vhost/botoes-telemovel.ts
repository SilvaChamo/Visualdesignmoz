'use client';

// Botões das barras no telemóvel (Silva, 15/10/2026): lado a lado, dois por linha, quando o texto cabe em meia largura;
// se algum botão da barra não cabe (o texto ia para duas ou três linhas), todos os botões dessa barra passam a uma só
// coluna, a toda a largura. O CSS sozinho não sabe se um texto cabe: mede-se aqui e marca-se a barra com .uma-coluna.
import { useEffect } from 'react';

const BARRAS = '.frm-foot, .mfoot, .acoes-topo';
const TELEMOVEL = '(max-width: 768px)';

function acertar() {
  const raiz = document.querySelector<HTMLElement>('.vh');
  if (!raiz) return;
  const tel = window.matchMedia(TELEMOVEL).matches;
  raiz.querySelectorAll<HTMLElement>(BARRAS).forEach((barra) => {
    // mede-se sempre a meia largura (sem a marca); voltar a pôr a marca no mesmo instante não chega a piscar
    barra.classList.remove('uma-coluna');
    if (!tel) return;
    const botoes = Array.from(barra.children).filter(
      (b): b is HTMLElement => b instanceof HTMLElement && b.matches('.btn, button, a') && b.offsetParent !== null,
    );
    if (botoes.some((b) => b.scrollWidth > b.clientWidth + 1)) barra.classList.add('uma-coluna');
  });
}

/** Liga a medição ao painel: corre quando o conteúdo muda e quando o ecrã muda de tamanho */
export function useBotoesTelemovel() {
  useEffect(() => {
    let pedido = 0;
    const agendar = () => {
      if (pedido) return;
      pedido = requestAnimationFrame(() => {
        pedido = 0;
        acertar();
      });
    };
    agendar();
    // só filhos e texto (não atributos): a marca .uma-coluna que se põe aqui não volta a disparar a medição
    const obs = new MutationObserver(agendar);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', agendar);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', agendar);
      cancelAnimationFrame(pedido);
    };
  }, []);
}
