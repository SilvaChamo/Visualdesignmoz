'use client';

import { Globe, Mail, Server, Palette, ArrowRight, AlertCircle } from 'lucide-react';
import type { UserProductsSummary } from '@/lib/user-products';
import { useGet } from '../carga';

// Compras › "Adicionar produtos em falta" (Silva, 27/10/2026): quem tem só o plano de e-mail (ou só o domínio) vê aqui o que ainda
// não tem na conta — domínio, hospedagem, e-mail profissional — e compra com um clique. A compra volta a este painel (ver
// `marcarVoltaAoPainel` na página). Só mostra o que falta: com tudo comprado, a faixa nem aparece. "Serviços VisualDesign" (design,
// brindes, audiovisual) é sempre possível: abre a nova encomenda.
type Cartao = { chave: string; titulo: string; texto: string; accao: string; href?: string; Icone: typeof Globe; cor: string };

export function ProdutosEmFalta({ onNovaEncomenda, aoComprar }: { onNovaEncomenda: () => void; aoComprar?: () => void }) {
  const { dados } = useGet<{ products?: UserProductsSummary | null }>('/api/my-products');
  const p = dados?.products;
  if (!p) return null;
  const pendente = (tipo: 'domain' | 'hosting' | 'email') => p.pendingSessions.some((s) => s.items.some((i) => i.type === tipo));
  const semDominioNoPlano = p.emailPlans.filter((x) => !x.domain).length;
  const cartoes: Cartao[] = [];
  if (p.domains.length === 0 && !pendente('domain'))
    cartoes.push({ chave: 'dominio', titulo: 'Registar domínio', texto: 'Pesquise e registe o seu domínio (.co.mz, .com, .org) para a sua marca.', accao: 'Registar agora', href: '/servicos/dominios?origem=painel', Icone: Globe, cor: 'purple' });
  if (p.hosting.length === 0 && !pendente('hosting'))
    cartoes.push({ chave: 'hospedagem', titulo: 'Hospedagem web', texto: 'Alojamento rápido e seguro para o seu site WordPress, com e-mail incluído.', accao: 'Ver planos', href: '/precos/hospedagem', Icone: Server, cor: 'red' });
  if (p.emailPlans.length === 0 && !pendente('email'))
    cartoes.push({ chave: 'email', titulo: 'E-mail profissional', texto: 'Contas de e-mail com o seu próprio domínio, webmail e anti-spam.', accao: 'Ver planos', href: '/precos/email', Icone: Mail, cor: 'blue' });
  cartoes.push({ chave: 'servicos', titulo: 'Serviços VisualDesign', texto: 'Design gráfico, web design, brindes e produção audiovisual — peça a sua cotação.', accao: 'Nova encomenda', Icone: Palette, cor: 'amber' });
  const soServicos = cartoes.length === 1;
  if (soServicos && semDominioNoPlano === 0) return null;
  const COR: Record<string, string> = {
    purple: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/50',
    red: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50',
    blue: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50',
  };
  return (
    <div className="tw-livre produtos-em-falta" style={{ marginBottom: 16 }}>
      <div className="rounded border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">Adicionar produtos em falta</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400" style={{ marginTop: 4, marginBottom: 16 }}>Estes são os serviços que ainda não tem na conta — escolha o que quer acrescentar</p>
        {semDominioNoPlano > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              O seu plano de e-mail ainda não tem domínio associado. Registe um domínio novo ou associe um que já tenha, para o e-mail começar a funcionar.
            </span>
          </div>
        )}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {cartoes.map(({ chave, titulo, texto, accao, href, Icone, cor }) => {
            const conteudo = (
              <>
                <div>
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg border ${COR[cor]}`}>
                    <Icone className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm font-bold text-zinc-900 group-hover:text-red-600 dark:text-zinc-100">{titulo}</h4>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{texto}</p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                  <span>{accao}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </>
            );
            const classes = 'group flex flex-col justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 text-left shadow-sm transition-all hover:border-red-500/50 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:bg-zinc-900';
            return href ? (
              <a key={chave} href={href} className={classes} onClick={aoComprar}>
                {conteudo}
              </a>
            ) : (
              <button key={chave} type="button" className={classes} onClick={onNovaEncomenda}>
                {conteudo}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
