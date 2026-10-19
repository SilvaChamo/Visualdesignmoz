'use client';

import Link from 'next/link';
import { ClipboardList, Package, Sparkles, UserCircle } from 'lucide-react';
import { CUSTOM_CATEGORIA_ID, formatMt } from '@/lib/pricing-catalog';
import type { EncomendaDraft, priceEncomendaItems } from '@/lib/encomenda-checkout';

type EncomendaPricing = ReturnType<typeof priceEncomendaItems>;

/** Volta ao formulário com o rascunho já preenchido (ver ?retomar=1 em /cotacao). */
export const ENCOMENDA_EDIT_PATH = '/cotacao?retomar=1';

export type FacturarEm = 'empresa' | 'responsavel';

/** Só faz sentido escolher quando a encomenda tem um responsável diferente da própria empresa. */
export function podeFacturarResponsavel(draft: EncomendaDraft): boolean {
  return draft.tipoCliente === 'empresa' && draft.contaDados !== 'empresa' && Boolean(draft.responsavel) && draft.responsavel !== draft.empresa;
}

/**
 * Dados a gravar na encomenda quando a factura sai em nome do responsável
 * (pessoa) em vez da empresa — mesmo formato das encomendas de particular
 * (nome no campo "empresa", sem NUIT). O nome da empresa não se perde: fica
 * nas notas.
 */
export function dadosFacturaResponsavel(draft: EncomendaDraft) {
  return {
    empresa: draft.responsavel,
    nif: '',
    telefoneInstitucional: draft.telefone,
    emailInstitucional: draft.email,
    website: '',
    notas: [`Empresa: ${draft.empresa}${draft.nif ? ` (NUIT ${draft.nif})` : ''} — factura em nome do responsável.`, draft.notas]
      .filter(Boolean)
      .join('\n'),
  };
}

/**
 * "Faturado Para" de uma encomenda: os dados indicados no formulário
 * /cotacao (são esses que vão para a cotação e para a factura), não o perfil
 * da conta como nas compras de domínio/hospedagem. Por omissão a factura sai
 * em nome da empresa; quando há um responsável à parte, pode sair em nome
 * dele.
 */
export function EncomendaFaturadoPara({
  draft,
  facturarEm,
  onFacturarEmChange,
}: {
  draft: EncomendaDraft;
  facturarEm: FacturarEm;
  onFacturarEmChange: (value: FacturarEm) => void;
}) {
  const escolha = podeFacturarResponsavel(draft);
  const emNomeDoResponsavel = escolha && facturarEm === 'responsavel';
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 flex items-center gap-1.5">
          <UserCircle className="w-3.5 h-3.5" /> Faturado Para
        </p>
        <Link href={`${ENCOMENDA_EDIT_PATH}&passo=dados`} className="text-[10px] font-bold text-slate-400 hover:text-red-600 dark:hover:text-red-400">
          Editar
        </Link>
      </div>

      {escolha && (
        <div className="mb-3 flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-zinc-800 rounded-md w-fit">
          {(['empresa', 'responsavel'] as const).map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => onFacturarEmChange(opcao)}
              className={`px-3 py-1 rounded text-[11px] font-bold transition-colors ${
                facturarEm === opcao ? 'bg-white dark:bg-zinc-950 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              {opcao === 'empresa' ? 'Empresa (recomendado)' : 'Responsável'}
            </button>
          ))}
        </div>
      )}

      {emNomeDoResponsavel ? (
        <>
          <p className="font-bold text-slate-800 dark:text-zinc-100 text-sm">
            {draft.responsavel}{draft.cargo ? ` — ${draft.cargo}` : ''}
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 truncate">Email: {draft.email}</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Contacto: {draft.telefone}</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Endereço: {draft.endereco || '—'}</p>
        </>
      ) : (
        <>
          <p className="font-bold text-slate-800 dark:text-zinc-100 text-sm">{draft.empresa}</p>
          {draft.nif && <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">NUIT: {draft.nif}</p>}
          {escolha && (
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Responsável: {draft.responsavel}{draft.cargo ? ` — ${draft.cargo}` : ''}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 truncate">Email: {draft.emailInstitucional || draft.email}</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Contacto: {draft.telefoneInstitucional || draft.telefone}</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Endereço: {draft.endereco || '—'}</p>
        </>
      )}
    </div>
  );
}

/** Checkout de encomenda sem sessão (ex.: expirou) — a conta cria-se no formulário /cotacao, aqui só se entra. */
export function EncomendaLoginNecessario({ loginHref }: { loginHref: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h3 className="font-bold text-slate-800 dark:text-zinc-100 text-sm font-panel">Inicie sessão para pagar a encomenda</h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
          A sua encomenda continua guardada. Entre na conta criada no pedido — ou, se ainda não a criou, volte ao pedido para a criar.
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Link href={loginHref} className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-md transition-colors">
          Iniciar sessão
        </Link>
        <Link href={ENCOMENDA_EDIT_PATH} className="border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 font-bold text-xs px-4 py-2.5 rounded-md hover:border-slate-300 transition-colors">
          Criar conta
        </Link>
      </div>
    </div>
  );
}

/** Resumo da encomenda no checkout — mesmos valores da pré-visualização em /cotacao (IVA acrescido, adiantamento de 70%). */
export function EncomendaResumoCard({ draft, pricing }: { draft: EncomendaDraft; pricing: EncomendaPricing }) {
  const temValor = pricing.subtotalMt > 0;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" />
          Resumo da Encomenda
        </h3>
        <Link href={ENCOMENDA_EDIT_PATH} className="text-[10px] font-bold text-slate-400 hover:text-red-600 dark:hover:text-red-400">
          Alterar encomenda
        </Link>
      </div>

      <div className="border-t border-slate-200 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800/40">
        {pricing.linhas.map((linha, idx) => (
          <div key={idx} className="py-3 grid grid-cols-1 sm:grid-cols-[1.4fr_1.2fr_auto] gap-2 sm:gap-4 sm:items-center">
            <div className="flex gap-2.5 items-start min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-850 flex items-center justify-center flex-shrink-0 mt-0.5">
                {linha.categoriaId === CUSTOM_CATEGORIA_ID
                  ? <Sparkles className="w-4 h-4 text-red-600 dark:text-red-400" />
                  : <Package className="w-4 h-4 text-red-600 dark:text-red-400" />}
              </div>
              <div className="min-w-0">
                <span className="inline-block px-1.5 py-0.2 bg-slate-100 dark:bg-zinc-800 text-[8px] font-bold text-slate-500 dark:text-zinc-400 rounded uppercase tracking-wider mb-0.5">
                  Encomenda
                </span>
                <h4 className="font-bold text-slate-800 dark:text-zinc-100 text-sm leading-tight">{linha.categoriaLabel}</h4>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 break-words">{linha.produto}</p>
              </div>
            </div>

            <div className="pl-[42px] sm:pl-0 min-w-0 sm:flex sm:flex-col sm:items-center sm:justify-center sm:text-center">
              <span className="text-xs text-slate-400">
                Qtd.: {linha.quantidade}
                {!linha.sobConsulta && (
                  <> × {linha.startingAt ? 'a partir de ' : ''}{formatMt(linha.precoUnitarioMt)} MT</>
                )}
              </span>
            </div>

            <div className="pl-[42px] sm:pl-0 flex items-center justify-end flex-shrink-0">
              {linha.sobConsulta ? (
                <span className="font-bold text-sm text-red-600 dark:text-red-400">Sob Consulta</span>
              ) : (
                <span className="font-bold text-base text-slate-800 dark:text-zinc-100">{formatMt(linha.subtotalMt)} MT</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 mt-1 border-t border-dashed border-slate-300 dark:border-zinc-700 space-y-1.5 text-sm">
        {temValor && (
          <>
            <div className="flex justify-between text-slate-500 dark:text-zinc-400">
              <span>Subtotal</span>
              <span>{formatMt(pricing.subtotalMt)} MT</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-zinc-400">
              <span>IVA (16%, acrescido)</span>
              <span>{formatMt(pricing.ivaMt)} MT</span>
            </div>
            <div className="flex justify-between text-slate-700 dark:text-zinc-200 font-bold">
              <span>Valor total da factura</span>
              <span>{formatMt(pricing.totalComIvaMt)} MT</span>
            </div>
            <div className="flex justify-between items-center pt-1.5 mt-1.5 border-t border-slate-200 dark:border-zinc-800">
              <span className="font-black text-slate-800 dark:text-zinc-100 uppercase">A pagar agora — adiantamento 70%</span>
              <span className="font-black text-xl text-red-600 dark:text-red-400">{formatMt(pricing.adiantamentoMt)} MT</span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 text-right">
              Remanescente de {formatMt(pricing.remanescenteMt)} MT (30%) pago na entrega.
            </p>
          </>
        )}
        {pricing.hasSobConsulta && (
          <p className="text-xs text-slate-500 dark:text-zinc-400 italic">
            {temValor
              ? 'Os serviços Sob Consulta não entram neste total — a equipa entra em contacto para confirmar o valor.'
              : 'Esta encomenda é Sob Consulta — submeta o pedido e a equipa entra em contacto para confirmar o valor e as condições de pagamento.'}
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500 dark:text-zinc-400">
        <p>
          <span className="font-bold text-slate-600 dark:text-zinc-300">Entrega pretendida: </span>
          {draft.dataLimiteEntrega ? new Date(draft.dataLimiteEntrega).toLocaleDateString('pt-PT') : '—'}
        </p>
        {draft.notas && (
          <p className="sm:col-span-2 whitespace-pre-line">
            <span className="font-bold text-slate-600 dark:text-zinc-300">Notas: </span>
            {draft.notas}
          </p>
        )}
      </div>
    </div>
  );
}

/** Checkout aberto em modo encomenda sem nenhum rascunho (expirou, ou já foi submetido noutro separador). */
export function EncomendaVazia() {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-12 text-center max-w-lg mx-auto space-y-6 shadow-sm">
      <ClipboardList className="w-16 h-16 text-slate-300 dark:text-zinc-700 mx-auto" />
      <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100 font-panel">Não há nenhuma encomenda por pagar</h2>
      <p className="text-sm text-slate-500 dark:text-zinc-400">
        Escolha os serviços e preencha os dados da encomenda — depois volta aqui para pagar a factura.
      </p>
      <Link
        href="/precos"
        className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-md transition-colors"
      >
        Ver serviços e preços
      </Link>
    </div>
  );
}
