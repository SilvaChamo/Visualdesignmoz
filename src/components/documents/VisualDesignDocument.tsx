'use client';

import type { ReactNode } from 'react';
import { Printer } from 'lucide-react';

/**
 * Peças comuns dos documentos oficiais da VisualDESIGN (Cotação/Factura em
 * /cotacao/[id], Recibo das compras em /recibo/[id]) — o mesmo cabeçalho, o
 * mesmo selo e a mesma barra "Descarregar PDF", para todos os documentos
 * saírem iguais. O cartão leva id="quote-print-area": é o que o CSS de
 * impressão (globals.css) imprime.
 */

export function DocumentCompanyHeader() {
  return (
    <div className="flex flex-col sm:flex-row items-start justify-between gap-6 border-b border-zinc-200 pb-6 mb-6">
      <div className="h-12 w-44 relative shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/Logo - horizontal.jpg" alt="VisualDESIGN" className="h-full w-full object-contain object-left" />
      </div>
      <div className="text-xs text-zinc-500 text-left sm:text-right leading-relaxed">
        <p className="font-bold text-zinc-800">VisualDESIGN Services, Lda.</p>
        <p>Maputo, Moçambique</p>
        <p>NUIT: 400597243</p>
        <p>+258 82 52 88 318 / +258 84 73 96 739</p>
        <p>info@visualdesignmoz.com</p>
        <p>visualdesignmoz.com</p>
      </div>
    </div>
  );
}

/** Selo/assinatura electrónica — validação visual de que o documento
 * foi emitido pelo sistema da VisualDESIGN, não editado à mão. */
export function DocumentElectronicSeal() {
  return (
    <div className="mt-8 pt-4 border-t border-zinc-200 flex items-center justify-end gap-2">
      <div className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full border border-red-600 text-red-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="text-right leading-tight">
        <p className="text-xs font-bold text-zinc-800">VisualDESIGN Services, Lda.</p>
        <p className="text-[11px] text-zinc-500">Documento gerado e validado electronicamente — dispensa assinatura manuscrita.</p>
      </div>
    </div>
  );
}

/** Cartão branco do documento (o que se imprime). */
export function DocumentCard({ embed, children }: { embed: boolean; children: ReactNode }) {
  return (
    <div id="quote-print-area" className={`bg-white dark:bg-white text-zinc-900 shadow-sm border border-zinc-200 p-8 sm:p-12 ${embed ? 'rounded-lg rounded-tr-none' : 'rounded-lg'}`}>
      {children}
    </div>
  );
}

/** Modo embutido (popup/iframe): sem o cabeçalho do site, só a barra de acções e o documento. */
export function DocumentEmbedFrame({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-white">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex justify-end gap-3 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-zinc-900 text-white font-bold px-5 py-2.5 rounded-md text-sm hover:opacity-90 transition-opacity"
          >
            <Printer className="w-4 h-4" />
            <span>Descarregar PDF</span>
          </button>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Abre um documento num popup centrado — o mesmo usado na Contabilidade ("Ver factura"). */
export function openDocumentWindow(url: string, name: string) {
  const w = 900;
  const h = 1000;
  const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
  window.open(url, name, `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
}
