import type { Metadata } from 'next';
import { quandoBuild, versaoBuild } from '@/lib/versao-build';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Versão do site',
  robots: { index: false, follow: false },
};

const FUSO = 'Africa/Maputo';

function haQuanto(d: Date): string {
  const min = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} minuto${min === 1 ? '' : 's'}`;
  const h = Math.floor(min / 60);
  if (h < 48) return `há ${h} hora${h === 1 ? '' : 's'}`;
  return `há ${Math.floor(h / 24)} dias`;
}

/** Que versão do site este servidor está a servir agora, em linguagem simples (pedido do Silva, 13/10/2026: o
 *  /api/versao só dá o código, para o painel). Lida sempre no momento — nunca guardada. */
export default function VersaoPage() {
  const versao = versaoBuild();
  const quando = quandoBuild();
  const hora = quando?.toLocaleTimeString('pt-PT', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
  const data = quando?.toLocaleDateString('pt-PT', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' });
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-24 dark:bg-[#15161e]">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-[#393e4d] dark:bg-[#272a34]">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          No ar
        </span>
        <h1 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Versão publicada no site</h1>
        {quando ? (
          <>
            <p className="mt-5 text-5xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{hora}</p>
            <p className="mt-2 text-[15px] text-zinc-600 dark:text-zinc-300">
              {data} · hora de Maputo
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{haQuanto(quando)}</p>
          </>
        ) : (
          <p className="mt-5 text-[15px] text-zinc-600 dark:text-zinc-300">Versão de desenvolvimento (sem publicação)</p>
        )}
        <div className="mt-6 rounded-lg bg-zinc-50 px-4 py-3 text-sm dark:bg-[#15161e]">
          <span className="text-zinc-500 dark:text-zinc-400">Código da versão</span>
          <code className="mt-1 block break-all font-mono text-[13px] text-zinc-800 dark:text-zinc-200">{versao}</code>
        </div>
        <p className="mt-6 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Esta página pergunta ao servidor, no momento, que versão está a servir. Se a hora é a da última publicação, o
          site está actualizado; se o que vê noutra página parece antigo, recarregue-a com Ctrl+Shift+R (no Mac,
          Cmd+Shift+R).
        </p>
        <a href="/" className="mt-6 inline-block text-sm font-medium text-red-600 hover:text-red-500 dark:text-red-400">
          Voltar ao site
        </a>
      </div>
    </div>
  );
}
