'use client';

import { useEffect, useState } from 'react';
import { Globe, Mail, Server, X } from 'lucide-react';

// Faixa de publicidade no painel das encomendas para quem ainda só tem encomendas (Silva, 26/10/2026): domínios, hospedagem
// e e-mail profissional. Ao comprar, a conta passa a cliente e o login leva ao painel certo (só domínio: a vista compacta;
// hospedagem: o painel do pacote). Pode fechar-se; volta na sessão seguinte.
const CHAVE = 'vd-promo-produtos-fechada';

const OFERTAS = [
  { href: '/servicos/dominios', texto: 'Comprar domínio', Icone: Globe },
  { href: '/precos/hospedagem', texto: 'Comprar hospedagem', Icone: Server },
  { href: '/precos/email', texto: 'E-mail profissional', Icone: Mail },
] as const;

export function PromoProdutos() {
  const [fechada, setFechada] = useState(true); // escondida até ler a sessão, para não piscar
  useEffect(() => {
    try {
      setFechada(sessionStorage.getItem(CHAVE) === '1');
    } catch {
      setFechada(false);
    }
  }, []);
  if (fechada) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-gray-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-zinc-200">
      <span className="font-semibold">Precisa de domínio, hospedagem ou e-mail profissional?</span>
      <span className="hidden text-gray-600 dark:text-zinc-400 md:inline">Ao comprar, passa para o painel de gestão do serviço.</span>
      <div className="flex flex-wrap items-center gap-2">
        {OFERTAS.map(({ href, texto, Icone }) => (
          <a
            key={href}
            href={href}
            className="inline-flex items-center gap-1.5 rounded border border-red-200 bg-white px-2.5 py-1 font-medium text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-zinc-800"
          >
            <Icone className="h-4 w-4" />
            {texto}
          </a>
        ))}
      </div>
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => {
          setFechada(true);
          try {
            sessionStorage.setItem(CHAVE, '1');
          } catch {
            /* sem armazenamento: só fecha agora */
          }
        }}
        className="ml-auto text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
