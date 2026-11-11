'use client';

// VhostMail dentro do painel: Contas de e-mail › Entrada / Saída / Abrir (maquete aprovado a 11/11/2026).
// A página do VhostMail vem de /api/vhost/vhostmail e mostra-se num iframe por baixo da faixa do caminho
// (com o seletor de domínio); a coluna do menu à esquerda dá lugar a um botão "Voltar".
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useVH } from '../context';
import { EsperaPagina } from '../carga';
import type { ScreenFn } from '../screens';

export type PastaVhostmail = 'entrada' | 'enviados';

/** Endereço da página do VhostMail de uma caixa (Entrada ou Enviados) */
export const vhostmailPath = (pasta: PastaVhostmail, endereco: string) => '/utilizador/email/vhostmail/' + pasta + '/' + encodeURIComponent(endereco);

function Vhostmail({ pasta, conta }: { pasta: PastaVhostmail; conta: string }) {
  const vh = useVH();
  const { nav } = vh;
  const tema = vh.s.theme;
  const plano = vh.a.hpkg || vh.a.pkg || '';
  const espera = useContext(EsperaPagina);
  const quadro = useRef<HTMLIFrameElement>(null);
  const carregou = useRef<(() => void) | null>(null);
  // o tema só conta ao abrir; depois muda-se por mensagem, sem recarregar a caixa
  const [temaInicial] = useState(tema);
  const src = useMemo(
    () => '/api/vhost/vhostmail?' + new URLSearchParams({ conta, pasta, tema: temaInicial, plano }).toString(),
    [conta, pasta, plano, temaInicial],
  );

  // a página só aparece quando o VhostMail carregou (nunca uma tela branca)
  useEffect(() => {
    const fim = espera ? espera.comecar() : null;
    const t = setTimeout(() => fim?.(), 8000);
    const ouvir = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== quadro.current?.contentWindow) return;
      const d = e.data as { vhostmail?: number; acao?: string } | null;
      if (!d?.vhostmail || typeof d.acao !== 'string') return;
      if (d.acao === 'voltar') nav('/utilizador/email');
      else if (d.acao === 'criar') nav('/utilizador/email/nova');
      else if (d.acao === 'migrar') nav('/utilizador/imapsync');
      else if (d.acao.startsWith('abrir:')) {
        const end = d.acao.slice(6).trim().toLowerCase();
        if (/^[^\s@,;:"'<>()]+@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(end)) nav(vhostmailPath('entrada', end));
      }
    };
    window.addEventListener('message', ouvir);
    carregou.current = () => {
      clearTimeout(t);
      fim?.();
    };
    return () => {
      clearTimeout(t);
      window.removeEventListener('message', ouvir);
      fim?.();
    };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    quadro.current?.contentWindow?.postMessage({ vhostmail: 1, tema }, location.origin);
  }, [tema]);

  // a moldura ocupa o ecrã todo (a altura vem do CSS, sem medir nada)
  return (
    <div className="vm-moldura">
      <iframe ref={quadro} className="vm-quadro" title="VhostMail" src={src} allow="clipboard-write" onLoad={() => carregou.current?.()} />
    </div>
  );
}

/** Ecrã do VhostMail: /utilizador/email/vhostmail/<entrada|enviados>/<endereço> */
export const vhostmailPagina = (pasta: string, endereco: string): ScreenFn => () => {
  const p: PastaVhostmail = pasta === 'enviados' ? 'enviados' : 'entrada';
  return {
    title: 'VhostMail',
    desc: endereco,
    crumbs: [{ t: 'E-mails', path: '/utilizador/email' }, { t: 'VhostMail' }, { t: (p === 'enviados' ? 'Enviados' : 'Entrada') + ' · ' + endereco }],
    semCartao: true,
    ecraInteiro: true,
    body: <Vhostmail key={p + '|' + endereco} pasta={p} conta={endereco} />,
  };
};
