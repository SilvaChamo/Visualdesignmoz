'use client';

/**
 * Fundo de triângulos grandes, como o da entrada do DirectAdmin: usado na página de entrada do painel (entrada.tsx) e
 * na página de registo do site quando se chega lá a partir do painel (AuthPageShell, fundoPainel).
 */
import { useMemo, useState } from 'react';

/** Fundo de triângulos grandes (como o do DA): cheios, com a luz a vir de cima à esquerda e a escurecer para baixo à
 *  direita; no modo claro, a cor do tema muito esbatida. Sempre o mesmo desenho. */
export function Triangulos({ escuro, cor = 'var(--red)' }: { escuro: boolean; cor?: string }) {
  const tri = useMemo(() => {
    let sem = 11;
    const rnd = () => ((sem = (sem * 16807) % 2147483647) - 1) / 2147483646;
    const C = 5;
    const L = 4;
    const W = 1600;
    const H = 1000;
    const pts: [number, number][][] = [];
    for (let j = 0; j <= L; j++) {
      pts.push([]);
      for (let i = 0; i <= C; i++) {
        const x = (i / C) * W + (i === 0 || i === C ? 0 : (rnd() - 0.5) * (W / C) * 0.9);
        const y = (j / L) * H + (j === 0 || j === L ? 0 : (rnd() - 0.5) * (H / L) * 0.9);
        pts[j].push([x, y]);
      }
    }
    const t: { d: string; luz: number }[] = [];
    const juntar = (q: [number, number][]) => {
      const cx = (q[0][0] + q[1][0] + q[2][0]) / 3 / W;
      const cy = (q[0][1] + q[1][1] + q[2][1]) / 3 / H;
      // 1 = canto de cima à esquerda (mais claro), 0 = canto de baixo à direita (mais escuro), com um pouco de acaso
      const luz = Math.max(0, Math.min(1, 1 - (cx * 0.6 + cy * 0.55) + (rnd() - 0.5) * 0.22));
      t.push({ d: 'M' + q.map(([x, y]) => x.toFixed(1) + ' ' + y.toFixed(1)).join('L') + 'Z', luz });
    };
    for (let j = 0; j < L; j++)
      for (let i = 0; i < C; i++) {
        const [a, b, c, d] = [pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]];
        if (rnd() > 0.5) {
          juntar([a, b, c]);
          juntar([a, c, d]);
        } else {
          juntar([a, b, d]);
          juntar([b, c, d]);
        }
      }
    return t;
  }, []);
  return (
    <svg className="ent-fundo" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      {tri.map((x, k) => (
        <path
          key={k}
          d={x.d}
          style={{
            fill: escuro ? `hsl(225 4% ${(6 + x.luz * 17).toFixed(1)}%)` : `color-mix(in srgb, ${cor} ${(24 - x.luz * 16).toFixed(1)}%, #fff)`,
            stroke: escuro ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.35)',
            strokeWidth: 1,
          }}
        />
      ))}
    </svg>
  );
}

/** Fundo da entrada do painel: a imagem real (public/assets/fundo-login.jpg) — tal e qual no modo
 *  escuro; no claro, clareada e tingida com a cor do tema. Enquanto carrega (ou se faltar), os triângulos desenhados. */
export function FundoPainel({ escuro, cor = 'var(--red)' }: { escuro: boolean; cor?: string }) {
  const [img, setImg] = useState<boolean | null>(null);
  const cheio = { position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' } as const;
  return (
    <>
      {img !== true && <Triangulos escuro={escuro} cor={cor} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="ent-fundo-img"
        src="/assets/fundo-login.jpg"
        alt=""
        aria-hidden
        onLoad={() => setImg(true)}
        onError={() => setImg(false)}
        style={{ ...cheio, objectFit: 'cover', opacity: img ? 1 : 0, transition: 'opacity .3s', filter: escuro ? undefined : 'invert(1) grayscale(1) brightness(1.06) contrast(.85)' }}
      />
      {img && !escuro && <span aria-hidden style={{ ...cheio, background: cor, opacity: 0.16, mixBlendMode: 'multiply' }} />}
    </>
  );
}
