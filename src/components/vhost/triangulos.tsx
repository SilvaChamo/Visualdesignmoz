'use client';

/**
 * Fundo da página de entrada do painel (entrada.tsx): a imagem real (public/assets/fundo-login.jpg) — tal e qual no
 * modo escuro; no claro, clareada e tingida com a cor do tema.
 *
 * Antes havia por baixo um desenho de triângulos que ficava à vista enquanto a imagem carregava. Com a imagem já em
 * cache, ela carregava antes de o React ligar o onLoad, o aviso perdia-se e o desenho antigo ficava para sempre — umas
 * vezes via-se a imagem, outras o desenho (Silva, 14/10/2026: "não reconheço… porque ainda está lá"). Agora só existe
 * a imagem, sempre visível; enquanto chega, uma cor lisa parecida.
 */
export function FundoPainel({ escuro, cor = 'var(--red)' }: { escuro: boolean; cor?: string }) {
  const cheio = { position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' } as const;
  return (
    <>
      <span aria-hidden style={{ ...cheio, background: escuro ? '#1c1d21' : '#efe9ea' }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="ent-fundo-img"
        src="/assets/fundo-login.jpg"
        alt=""
        aria-hidden
        fetchPriority="high"
        decoding="sync"
        style={{ ...cheio, objectFit: 'cover', filter: escuro ? undefined : 'invert(1) grayscale(1) brightness(1.06) contrast(.85)' }}
      />
      {!escuro && <span aria-hidden style={{ ...cheio, background: cor, opacity: 0.16, mixBlendMode: 'multiply' }} />}
    </>
  );
}
