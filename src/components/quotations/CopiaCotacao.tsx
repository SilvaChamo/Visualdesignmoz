'use client';

// Encomendas › Cotação: se a equipa tem esta encomenda na calculadora, o cliente vê aqui só a cópia da cotação de lá (sem editar nada) e qualquer alteração
// na calculadora actualiza-a sozinha; sem cópia, mostra o documento de sempre. A folha chega como HTML e vê-se com os estilos desta página.
import { useEffect, useRef, useState } from 'react';

const ID_DOCUMENTO = 'cci-cotacao-documento';
// largura da folha A4 em píxeis (210 mm): a folha desenha-se sempre nesta largura e encolhe por inteiro em ecrãs pequenos, em vez de espremer a tabela
const LARGURA_A4 = 794;

function estilosDestaPagina(): string {
  return Array.from(document.styleSheets)
    .map((f) => {
      try {
        // os url() das fontes são relativos à folha de estilos, não à página: passam a absolutos
        return Array.from(f.cssRules)
          .map((r) => (f.href ? r.cssText.replace(/url\(\s*(["']?)(?!data:|https?:|\/)([^"')]+)\1\s*\)/g, (_m, q, u) => `url(${q}${new URL(u, f.href as string).href}${q})`) : r.cssText))
          .join('\n');
      } catch {
        return '';
      }
    })
    .join('\n');
}

export function CopiaCotacao({ id }: { id: string }) {
  const [html, setHtml] = useState<string | null | undefined>(undefined);
  const caixa = useRef<HTMLDivElement>(null);
  const folha = useRef<HTMLIFrameElement>(null);
  const [largura, setLargura] = useState(LARGURA_A4);
  const [altura, setAltura] = useState(1123);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLargura(el.clientWidth || LARGURA_A4));
    ro.observe(el);
    return () => ro.disconnect();
  }, [html]);
  // a altura da folha segue o conteúdo (sem corte nem barra de rolagem própria), também quando chegam as fotos e a fonte
  const medir = () => {
    const d = folha.current?.contentDocument;
    if (!d?.documentElement) return;
    const mede = () => setAltura(d.documentElement.scrollHeight);
    mede();
    new ResizeObserver(mede).observe(d.documentElement);
  };
  useEffect(() => {
    let vivo = true;
    const ler = () =>
      fetch(`/api/cotacoes/${id}/copia`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((j: { success?: boolean; html?: string | null }) => vivo && setHtml(j.success ? (j.html ?? null) : null))
        .catch(() => vivo && setHtml((h) => h ?? null));
    ler();
    const t = window.setInterval(ler, 30_000);
    return () => {
      vivo = false;
      window.clearInterval(t);
    };
  }, [id]);

  if (html === undefined) return <div className="min-h-[600px]" />;
  if (html === null) return <iframe key={id} src={`/cotacao/${id}?embed=1&payment=1`} className="w-full h-full min-h-[600px] border-0" title="Cotação" />;
  // a variável da fonte do site (Exo 2) vive na página, não no iframe: leva-se o valor para lá, senão a folha cai numa fonte de sistema
  const fonteSite = getComputedStyle(document.body).getPropertyValue('--font-exo2').trim();
  const pagina = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><base href="${window.location.origin}/"><style>${estilosDestaPagina()}</style><style>:root{${fonteSite ? `--font-exo2:${fonteSite};` : ''}}</style><style>html,body{background:#fff!important;margin:0;padding:0}body *{visibility:visible!important}#${ID_DOCUMENTO}{width:auto!important;min-width:0!important;max-width:210mm;margin:0 auto!important;border:0!important;box-shadow:none!important}</style></head><body>${html}</body></html>`;
  const escala = Math.min(1, largura / LARGURA_A4);
  return (
    <div ref={caixa} className="w-full" style={{ height: altura * escala, overflow: 'hidden' }}>
      <iframe
        key={id}
        ref={folha}
        onLoad={medir}
        sandbox="allow-same-origin"
        srcDoc={pagina}
        scrolling="no"
        className="border-0"
        style={{ width: LARGURA_A4, height: altura, transform: `scale(${escala})`, transformOrigin: 'top left' }}
        title="Cotação"
      />
    </div>
  );
}
