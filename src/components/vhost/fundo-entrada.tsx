/**
 * Fundo da entrada do painel: a imagem real (public/assets/fundo-login.jpg) — tal e qual no modo escuro; no claro,
 * clareada e tingida com a cor do tema. Sem fundo provisório nem fade: só esta imagem aparece (pré-carregada no layout).
 */
export function FundoPainel({ escuro, cor = 'var(--red)' }: { escuro: boolean; cor?: string }) {
  const cheio = { position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' } as const;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="ent-fundo-img"
        src="/assets/fundo-login.jpg"
        alt=""
        aria-hidden
        fetchPriority="high"
        style={{ ...cheio, objectFit: 'cover', filter: escuro ? undefined : 'invert(1) grayscale(1) brightness(1.06) contrast(.85)' }}
      />
      {!escuro && <span aria-hidden style={{ ...cheio, background: cor, opacity: 0.16, mixBlendMode: 'multiply' }} />}
    </>
  );
}
