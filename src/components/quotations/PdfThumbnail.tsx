'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';

type Props =
  | { url: string; className?: string; targetWidth: number; cover?: false }
  /** Preenche e recorta o contentor (como object-fit:cover) — o contentor
   * define o tamanho/aspecto via `className` (ex.: "aspect-[4/3] w-full"). */
  | { url: string; className?: string; cover: true; targetWidth?: undefined };

/**
 * Renderiza a 1ª página de um PDF para um <canvas> com pdf.js — em vez de
 * depender do visualizador de PDF nativo do browser (inconsistente entre
 * browsers, e o Chrome headless nem sequer o tem), garante sempre a mesma
 * miniatura/pré-visualização em qualquer sítio. #28.
 */
export function PdfThumbnail(props: Props) {
  const { url, className, cover } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  // Modo cover: mede o contentor real (a grelha decide a largura, o CSS
  // decide o aspecto) antes de saber a que resolução renderizar o canvas.
  useEffect(() => {
    if (!cover || !containerRef.current) return;
    const el = containerRef.current;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [cover]);

  const targetWidth = cover ? undefined : props.targetWidth;
  const ready = cover ? Boolean(box && box.w > 0 && box.h > 0) : true;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setFailed(false);

    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

        const pdf = await pdfjsLib.getDocument({ url }).promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

        const scale = cover && box
          ? Math.max((box.w * dpr) / baseViewport.width, (box.h * dpr) / baseViewport.height)
          : ((targetWidth as number) * dpr) / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        if (cover) {
          canvas.style.width = `${viewport.width / dpr}px`;
          canvas.style.height = `${viewport.height / dpr}px`;
        } else {
          canvas.style.width = `${targetWidth}px`;
          canvas.style.height = `${(targetWidth as number) * (viewport.height / viewport.width)}px`;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, targetWidth, cover, box?.w, box?.h, ready]);

  if (cover) {
    return (
      <div ref={containerRef} className={`relative overflow-hidden bg-gray-50 dark:bg-zinc-900 ${className || ''}`}>
        {failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-zinc-500">
            <FileText className="h-6 w-6" />
            <span className="text-[9px] font-bold uppercase tracking-wide">PDF</span>
          </div>
        ) : (
          <canvas ref={canvasRef} className="absolute left-1/2 top-0 -translate-x-1/2" />
        )}
      </div>
    );
  }

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1.5 bg-gray-50 text-gray-400 dark:bg-zinc-900 dark:text-zinc-500 ${className || ''}`}
        style={{ width: targetWidth }}
      >
        <FileText className="h-8 w-8" />
        <span className="text-[10px] font-bold uppercase tracking-wide">PDF</span>
      </div>
    );
  }

  return <canvas ref={canvasRef} className={className} />;
}
