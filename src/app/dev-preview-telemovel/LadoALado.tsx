'use client';

// Computador à esquerda, telemóvel à direita, a mesma página nos dois. Cada moldura é o site a sério (mesma sessão,
// mesmo servidor local), por isso o que se grava no código aparece logo nas duas. Com "Seguir" ligado, navegar numa
// moldura leva a outra para o mesmo endereço.
import { useCallback, useEffect, useRef, useState } from 'react';

const INICIO = '/vhost:2026/utilizador/ssl';
const LARGURAS = [320, 390, 430] as const;
const GUARDA = 'dev-preview-telemovel';

const lerGuardado = (): { caminho?: string; largura?: number; seguir?: boolean } => {
  try {
    return JSON.parse(localStorage.getItem(GUARDA) || '{}');
  } catch {
    return {};
  }
};

/** Caminho + pesquisa da página aberta numa moldura (mesma origem), ou null enquanto carrega */
const caminhoDe = (f: HTMLIFrameElement | null): string | null => {
  try {
    const l = f?.contentWindow?.location;
    return l && l.href !== 'about:blank' ? l.pathname + l.search + l.hash : null;
  } catch {
    return null;
  }
};

export default function LadoALado() {
  const [caminho, setCaminho] = useState(INICIO);
  // o endereço com que as molduras abrem; depois navegam sozinhas (mudar o src recarregava-as outra vez)
  const [inicial, setInicial] = useState(INICIO);
  const [escrito, setEscrito] = useState(INICIO);
  const [largura, setLargura] = useState<number>(390);
  const [seguir, setSeguir] = useState(true);
  const [pronto, setPronto] = useState(false);
  const pc = useRef<HTMLIFrameElement>(null);
  const tm = useRef<HTMLIFrameElement>(null);
  const ultimo = useRef<[string | null, string | null]>([null, null]);
  // molduras a carregar um endereço que lhes mandámos (ver "Seguir"): o documento de antes, o prazo e quando carregou
  const emEspera = useRef<({ doc: Document | null; ate: number; carregou?: number } | null)[]>([null, null]);
  const esperar = (k: 0 | 1, f: HTMLIFrameElement | null) => {
    let doc: Document | null = null;
    try {
      doc = f?.contentDocument ?? null;
    } catch {}
    emEspera.current[k] = { doc, ate: Date.now() + 10000 };
  };

  // endereço inicial: ?p=/caminho, senão o último usado, senão a página SSL do painel
  useEffect(() => {
    const g = lerGuardado();
    const p = new URLSearchParams(window.location.search).get('p') || g.caminho || INICIO;
    setCaminho(p);
    setEscrito(p);
    setInicial(p);
    if (g.largura) setLargura(g.largura);
    if (typeof g.seguir === 'boolean') setSeguir(g.seguir);
    setPronto(true);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    try {
      localStorage.setItem(GUARDA, JSON.stringify({ caminho, largura, seguir }));
    } catch {
      /* sem armazenamento: fica só nesta visita */
    }
  }, [pronto, caminho, largura, seguir]);

  // a barra de endereço acompanha a página aberta nas molduras (?p=…): o comando do projecto local recarrega esta aba, e
  // um ?p= antigo voltava sempre à mesma página (Silva, 17/10/2026: abria sempre nos Acessos do plano)
  useEffect(() => {
    if (!pronto) return;
    if (new URLSearchParams(window.location.search).get('p') === caminho) return;
    const p = encodeURIComponent(caminho).replace(/%2F/g, '/').replace(/%3A/g, ':');
    window.history.replaceState(null, '', window.location.pathname + '?p=' + p);
  }, [pronto, caminho]);

  const abrir = useCallback((p: string) => {
    const destino = p.trim() || INICIO;
    const c = destino.startsWith('/') ? destino : '/' + destino;
    ultimo.current = [c, c];
    setCaminho(c);
    setEscrito(c);
    ([pc.current, tm.current] as const).forEach((f, k) => {
      if (!f?.contentWindow) return;
      esperar(k as 0 | 1, f);
      f.contentWindow.location.replace(c);
    });
  }, []);

  const recarregar = () => {
    for (const f of [pc.current, tm.current]) f?.contentWindow?.location.reload();
  };

  // "Seguir": quando uma moldura muda de endereço, a outra vai para o mesmo.
  // - Dentro do painel (/host…) a outra muda de página sem recarregar: o painel lê o endereço no "popstate", como no
  //   botão Voltar. Antes recarregava a moldura inteira a cada clique (piscava e o CPU subia).
  // - Fora do painel recarrega-se; enquanto essa moldura não assenta no endereço novo (durante o carregamento ainda
  //   mostra o antigo, e ao abrir o painel pode acertar o endereço), o que ela mostra não manda a outra de volta.
  //   Era o ciclo do Silva (17/10/2026): "quando clico noutro menu volta a mesma página… pisca… o CPU está alto".
  useEffect(() => {
    if (!pronto) return;
    const id = window.setInterval(() => {
      const molduras = [pc.current, tm.current];
      const atual = molduras.map(caminhoDe);
      for (const k of [0, 1] as const) {
        const esp = emEspera.current[k];
        if (!esp) continue;
        let doc: Document | null = null;
        try {
          doc = molduras[k]?.contentDocument ?? null;
        } catch {}
        // assentou: o documento novo acabou de carregar há 1,5 s (ou passou o prazo)
        if (!esp.carregou && doc && doc !== esp.doc && doc.readyState === 'complete' && atual[k]) esp.carregou = Date.now();
        if (Date.now() > esp.ate || (esp.carregou && Date.now() - esp.carregou > 1500)) emEspera.current[k] = null;
        if (atual[k]) ultimo.current[k] = atual[k];
      }
      const presa = (k: 0 | 1) => !!emEspera.current[k];
      const i = ([0, 1] as const).find((k) => !presa(k) && atual[k] && atual[k] !== ultimo.current[k]);
      for (const k of [0, 1] as const) if (!presa(k) && atual[k]) ultimo.current[k] = atual[k];
      if (i === undefined) return;
      const mudou = atual[i] as string;
      setEscrito(mudou);
      setCaminho(mudou);
      if (!seguir) return;
      const o = i === 0 ? 1 : 0;
      const w = molduras[o]?.contentWindow;
      if (!w || atual[o] === mudou) return;
      ultimo.current[o] = mudou;
      if (atual[o]?.startsWith('/host') && mudou.startsWith('/host') && !mudou.includes('?') && !mudou.includes('#')) {
        w.history.pushState(null, '', mudou);
        w.dispatchEvent(new PopStateEvent('popstate'));
        // se o painel acertar o endereço ao mudar de página, isso não volta para a outra moldura
        emEspera.current[o] = { doc: null, ate: Date.now() + 1500, carregou: Date.now() };
      } else {
        esperar(o, molduras[o]);
        w.location.replace(mudou);
      }
    }, 600);
    return () => window.clearInterval(id);
  }, [pronto, seguir]);

  if (!pronto) return null;

  return (
    <div style={s.fundo}>
      <form
        style={s.barra}
        onSubmit={(e) => {
          e.preventDefault();
          abrir(escrito);
        }}
      >
        <b style={{ whiteSpace: 'nowrap' }}>Computador + telemóvel</b>
        <input style={s.campo} value={escrito} onChange={(e) => setEscrito(e.target.value)} aria-label="Endereço" spellCheck={false} />
        <button type="submit" style={s.botao}>
          Abrir
        </button>
        <button type="button" style={s.botao} onClick={recarregar}>
          Recarregar
        </button>
        <span style={{ display: 'flex', gap: 4 }}>
          {LARGURAS.map((w) => (
            <button key={w} type="button" onClick={() => setLargura(w)} style={{ ...s.botao, ...(w === largura ? s.ativo : {}) }}>
              {w}px
            </button>
          ))}
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={seguir} onChange={(e) => setSeguir(e.target.checked)} />
          Seguir a navegação
        </label>
      </form>

      <div style={s.palco}>
        <div style={s.coluna}>
          <div style={s.legenda}>Computador</div>
          <iframe ref={pc} src={inicial} title="Computador" style={s.molduraPc} />
        </div>
        <div style={{ ...s.coluna, flex: 'none', width: largura + 24 }}>
          <div style={s.legenda}>Telemóvel · {largura}px</div>
          <div style={s.telemovel}>
            <iframe ref={tm} src={inicial} title="Telemóvel" style={{ ...s.molduraTm, width: largura }} />
          </div>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  // por cima de tudo (o cabeçalho e o rodapé do site não interessam aqui)
  fundo: { position: 'fixed', inset: 0, zIndex: 2147483000, display: 'flex', flexDirection: 'column', background: '#e5e7eb', color: '#111827', font: '13px/1.4 system-ui, sans-serif' },
  barra: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fff', borderBottom: '1px solid #d1d5db', flexWrap: 'wrap' },
  campo: { flex: '1 1 260px', minWidth: 0, height: 32, padding: '0 10px', border: '1px solid #d1d5db', borderRadius: 6, font: '13px ui-monospace, monospace' },
  botao: { height: 32, padding: '0 12px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', font: 'inherit' },
  ativo: { background: '#111827', color: '#fff', borderColor: '#111827' },
  palco: { flex: 1, minHeight: 0, display: 'flex', gap: 16, padding: 12 },
  coluna: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  legenda: { fontWeight: 600, color: '#4b5563' },
  molduraPc: { flex: 1, width: '100%', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff' },
  telemovel: { flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', padding: 12, border: '1px solid #111827', borderRadius: 28, background: '#111827' },
  molduraTm: { height: '100%', border: 0, borderRadius: 16, background: '#fff' },
};
