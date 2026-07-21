import type { ReactNode, CSSProperties } from 'react';

export type NotchShape = 'start' | 'start-alt' | 'end' | 'mid' | 'mid-alt';

/**
 * Recorte em "V" usado entre secções da home para dar o efeito de fita contínua.
 * Copiado exactamente da implementação original (src/app/page.tsx) — não recalculado,
 * para garantir fidelidade visual em todas as landing pages de marca.
 *
 * - 'start':     topo direito (secção que abre o fluxo, ex. hero) — corte só no fundo,
 *   com as PONTAS a protuberar e o meio recuado (o meio da secção seguinte "sobe").
 * - 'start-alt': mesma posição de 'start' (corte só no fundo), mas com o padrão
 *   invertido — o MEIO protubera para baixo e as pontas recuam. Usar quando se quer
 *   que a sequência de encaixe comece "ao contrário" de 'start'.
 * - 'end':       fundo direito (secção que fecha por baixo de outra) — corte só no topo.
 * - 'mid':       dente saliente no MEIO do topo e do fundo (encostado nas pontas).
 * - 'mid-alt':   forma complementar de 'mid' — dente saliente nas PONTAS do topo e do
 *   fundo (encostado no meio). Duas secções 'mid' seguidas deixam um vazio nas pontas —
 *   por isso, entre duas secções 'mid'/'mid' consecutivas, a do meio tem de ser 'mid-alt'
 *   para o encaixe ficar sem buracos (ver Why-Us → Preços → Newsletter na home).
 */
export const CLIP_PATHS: Record<NotchShape, string> = {
  start:
    'polygon(0% 0%, 100% 0%, 100% 100%, calc(100% - var(--cl)) 100%, calc(100% - var(--cl) - 15px) calc(100% - 16px), calc(var(--cl) + 15px) calc(100% - 16px), var(--cl) 100%, 0% 100%)',
  'start-alt':
    'polygon(0% 0%, 100% 0%, 100% calc(100% - 16px), calc(100% - var(--cl)) calc(100% - 16px), calc(100% - var(--cl) - 15px) 100%, calc(var(--cl) + 15px) 100%, var(--cl) calc(100% - 16px), 0% calc(100% - 16px))',
  end:
    'polygon(0% 100%, 100% 100%, 100% 0%, calc(100% - var(--cl)) 0%, calc(100% - var(--cl) - 15px) 16px, calc(var(--cl) + 15px) 16px, var(--cl) 0%, 0% 0%)',
  mid:
    'polygon(0% 16px, var(--cl) 16px, calc(var(--cl) + 15px) 0%, calc(100% - var(--cl) - 15px) 0%, calc(100% - var(--cl)) 16px, 100% 16px, 100% calc(100% - 16px), calc(100% - var(--cl)) calc(100% - 16px), calc(100% - var(--cl) - 15px) 100%, calc(var(--cl) + 15px) 100%, var(--cl) calc(100% - 16px), 0% calc(100% - 16px))',
  'mid-alt':
    'polygon(0% 0%, var(--cl) 0%, calc(var(--cl) + 15px) 16px, calc(100% - var(--cl) - 15px) 16px, calc(100% - var(--cl)) 0%, 100% 0%, 100% 100%, calc(100% - var(--cl)) 100%, calc(100% - var(--cl) - 15px) calc(100% - 16px), calc(var(--cl) + 15px) calc(100% - 16px), var(--cl) 100%, 0% 100%)',
};

export function NotchSection({
  shape,
  bg,
  first = false,
  className = '',
  children,
}: {
  shape: NotchShape;
  bg: string;
  /** A primeira secção da página (ex. hero) não sobrepõe nada acima. */
  first?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`${bg} relative overflow-hidden ${first ? '' : '-mt-[16px] z-20'} ${className}`}
      style={
        {
          '--cl': 'max(24px, calc(50% - 616px))',
          clipPath: CLIP_PATHS[shape],
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
