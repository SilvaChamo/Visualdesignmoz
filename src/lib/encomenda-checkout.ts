import { CUSTOM_CATEGORIA_ID, findCategory, findItem } from '@/lib/pricing-catalog';

/**
 * Encomenda VisualDesign a caminho do checkout único.
 *
 * O formulário /cotacao recolhe a empresa, cria a conta (passo "Criar Conta",
 * com os dados do responsável ou da própria empresa) e os serviços, mas não
 * submete a encomenda: guarda o pedido aqui (rascunho local) e manda o
 * cliente, já com sessão, para o mesmo checkout das compras de
 * domínio/hospedagem (/checkout?encomenda=1) — só para pagar. É lá que se
 * escolhe o método e em nome de quem sai a factura, e que a encomenda é
 * finalmente gravada em quotation_requests — já com o método escolhido —
 * antes de pedir o comprovativo.
 *
 * localStorage (não sessionStorage): o formulário pode estar dentro do iframe
 * "Nova Encomenda" do painel /encomendas e o checkout abre na janela de topo;
 * o rascunho também tem de sobreviver a um "Fazer login" a meio do checkout.
 */
export const ENCOMENDA_CHECKOUT_PATH = '/checkout?encomenda=1';

const DRAFT_STORAGE_KEY = 'visualdesign_encomenda_checkout';
// O rascunho fica no balão do carrinho até ser pago (comprovativo enviado) ou
// cancelado — mas um esquecido não deve reaparecer para sempre.
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Disparado sempre que o rascunho muda — o balão do carrinho actualiza-se na hora. */
export const ENCOMENDA_DRAFT_EVENT = 'visualdesign:encomenda-draft';

export const ENCOMENDA_IVA_RATE = 0.16;
export const ENCOMENDA_ADIANTAMENTO_RATE = 0.7;

export type EncomendaDraftItem = {
  categoriaId: string;
  produto: string;
  quantidade: number;
};

export type MetodoEncomenda = 'mpesa' | 'transferencia';

/**
 * A encomenda já foi gravada (ao clicar "Pagar" no checkout) e espera o
 * comprovativo. O rascunho não é apagado nesse momento: o cliente pode
 * voltar atrás para rever, editar ou cancelar, e o balão do carrinho leva-o
 * de volta ao passo do comprovativo. `assinatura` são os dados com que foi
 * gravada — se o cliente os mudar, a encomenda gravada é descartada e
 * substituída (nunca fica uma duplicada).
 */
export type EncomendaRegistada = {
  quotationId: string;
  metodo: MetodoEncomenda;
  facturarEm: 'empresa' | 'responsavel';
  valorMt: number;
  assinatura: string;
};

/** Mesmos campos que POST /api/cotacoes espera, já resolvidos (pessoa singular usa os próprios dados como responsável). */
export type EncomendaDraft = {
  tipoCliente: 'empresa' | 'individual';
  empresa: string;
  nif: string;
  endereco: string;
  telefoneInstitucional: string;
  emailInstitucional: string;
  website: string;
  responsavel: string;
  cargo: string;
  telefone: string;
  email: string;
  /** Com que dados a conta (e o contacto da encomenda) foi criada no passo "Criar Conta" de /cotacao. */
  contaDados?: 'responsavel' | 'empresa';
  itens: EncomendaDraftItem[];
  dataLimiteEntrega: string;
  notas: string;
  registada?: EncomendaRegistada;
  savedAt: number;
};

function notifyDraftChanged() {
  try {
    window.dispatchEvent(new Event(ENCOMENDA_DRAFT_EVENT));
  } catch {
    // fora do browser — nada a avisar
  }
}

export function saveEncomendaDraft(draft: Omit<EncomendaDraft, 'savedAt'>): boolean {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
    notifyDraftChanged();
    return true;
  } catch {
    return false;
  }
}

export function loadEncomendaDraft(): EncomendaDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as EncomendaDraft;
    if (!Array.isArray(draft?.itens) || draft.itens.length === 0) return null;
    if (!draft.savedAt || Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearEncomendaDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    notifyDraftChanged();
  } catch {
    // sem storage disponível — nada a limpar
  }
}

/** Marca (ou desmarca, com null) o rascunho actual como já gravado à espera do comprovativo. */
export function setEncomendaRegistada(registada: EncomendaRegistada | null) {
  const draft = loadEncomendaDraft();
  if (!draft) return;
  const { savedAt: _savedAt, registada: _anterior, ...dados } = draft;
  saveEncomendaDraft(registada ? { ...dados, registada } : dados);
}

/** Os dados da encomenda em si (sem datas nem estado) — para saber se mudaram desde que foi gravada. */
export function encomendaDraftSignature(draft: Omit<EncomendaDraft, 'savedAt' | 'registada'>): string {
  return JSON.stringify([
    draft.tipoCliente,
    draft.empresa,
    draft.nif,
    draft.endereco,
    draft.telefoneInstitucional,
    draft.emailInstitucional,
    draft.website,
    draft.responsavel,
    draft.cargo,
    draft.telefone,
    draft.email,
    draft.contaDados ?? null,
    draft.itens.map((i) => [i.categoriaId, i.produto, i.quantidade]),
    draft.dataLimiteEntrega,
    draft.notas,
  ]);
}

/** URL do passo do comprovativo de uma encomenda já gravada. */
export function encomendaComprovativoPath(registada: Pick<EncomendaRegistada, 'quotationId' | 'metodo'>): string {
  return `${ENCOMENDA_CHECKOUT_PATH}&pendingQuotationId=${encodeURIComponent(registada.quotationId)}&metodo=${registada.metodo}`;
}

/** A encomenda gravada no checkout, se ainda corresponder ao rascunho (não editado depois). */
export function encomendaRegistadaValida(draft: EncomendaDraft | null): EncomendaRegistada | null {
  if (!draft?.registada) return null;
  return draft.registada.assinatura === encomendaDraftSignature(draft) ? draft.registada : null;
}

/** Onde o cliente estava: no comprovativo se a encomenda já foi gravada, senão no resumo para pagar. */
export function encomendaResumePath(draft: EncomendaDraft): string {
  const registada = encomendaRegistadaValida(draft);
  return registada ? encomendaComprovativoPath(registada) : ENCOMENDA_CHECKOUT_PATH;
}

/**
 * Apaga a encomenda gravada no checkout que ainda não tem comprovativo (o
 * cliente quer editar os dados ou cancelar) — ver /api/cotacoes/[id]/descartar.
 * `true` se já não existe (apagada agora, ou já não estava lá).
 */
export async function descartarEncomendaRegistada(
  quotationId: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(`/api/cotacoes/${encodeURIComponent(quotationId)}/descartar`, { method: 'POST' });
    if (res.ok || res.status === 404) return { ok: true, status: res.status };
    const data = await res.json().catch(() => ({}));
    return { ok: false, status: res.status, error: data?.error || 'Não foi possível alterar a encomenda.' };
  } catch {
    return { ok: false, error: 'Falha ao comunicar com o servidor.' };
  }
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Adiantamento (70%) e remanescente (30%) sobre o total COM IVA acrescido —
 * a mesma conta da pré-visualização em /cotacao e do documento de cotação
 * (/cotacao/[id]), para o valor pedido no checkout bater certo com o que foi
 * prometido ao cliente nesses dois sítios. `totalMt` é a soma sem IVA dos
 * itens com preço (itens Sob Consulta ficam de fora).
 */
export function encomendaPaymentSplit(totalMt: number) {
  const ivaMt = round2(totalMt * ENCOMENDA_IVA_RATE);
  const totalComIvaMt = round2(totalMt + ivaMt);
  const adiantamentoMt = round2(totalComIvaMt * ENCOMENDA_ADIANTAMENTO_RATE);
  const remanescenteMt = round2(totalComIvaMt - adiantamentoMt);
  return { subtotalMt: totalMt, ivaMt, totalComIvaMt, adiantamentoMt, remanescenteMt };
}

/** Linhas da encomenda com preço do catálogo — só para mostrar; o servidor recalcula tudo em POST /api/cotacoes. */
export function priceEncomendaItems(itens: EncomendaDraftItem[]) {
  const linhas = itens.map((li) => {
    const isCustom = li.categoriaId === CUSTOM_CATEGORIA_ID;
    const found = isCustom ? undefined : findItem(li.categoriaId, li.produto);
    const sobConsulta = isCustom || !found || Boolean(found.item.sobConsulta);
    return {
      ...li,
      categoriaLabel: isCustom ? 'Pedido Personalizado' : (findCategory(li.categoriaId)?.label ?? li.categoriaId),
      precoUnitarioMt: found?.item.price ?? 0,
      startingAt: Boolean(found?.item.startingAt),
      sobConsulta,
      subtotalMt: sobConsulta || !found ? 0 : found.item.price * li.quantidade,
    };
  });
  const totalMt = linhas.reduce((sum, l) => sum + l.subtotalMt, 0);
  return {
    linhas,
    hasSobConsulta: linhas.some((l) => l.sobConsulta),
    ...encomendaPaymentSplit(totalMt),
  };
}

type ProductsSummaryLike = {
  tier?: string;
  hasPaidProducts?: boolean;
  emailPlans?: unknown[];
  pendingSessions?: unknown[];
} | null | undefined;

/**
 * Painel de destino depois de uma encomenda VisualDesign. Quem não tem
 * domínio, hospedagem nem outro produto VisualWeb (email, pedidos de
 * carrinho por confirmar) é cliente só das encomendas — vai para o painel
 * próprio, /encomendas. Um cliente que já tem produtos fica no painel dele,
 * aberto na secção das encomendas; os restantes painéis (profissional,
 * revendedor, admin) não têm essa secção, por isso também vão para
 * /encomendas, que aceita qualquer conta autenticada.
 */
export function encomendaLandingPath(role: string | null | undefined, products: ProductsSummaryLike): string {
  const temProdutosVisualWeb = Boolean(
    products &&
      (products.hasPaidProducts ||
        (products.tier && products.tier !== 'none') ||
        (products.emailPlans?.length ?? 0) > 0 ||
        (products.pendingSessions?.length ?? 0) > 0),
  );
  if (temProdutosVisualWeb && role === 'client') return '/cliente?section=encomendas';
  return '/encomendas';
}

/** Versão do browser: lê o papel e os produtos da conta autenticada (/api/my-products). */
export async function resolveEncomendaLandingPath(): Promise<string> {
  try {
    const res = await fetch('/api/my-products', { cache: 'no-store' });
    if (!res.ok) return '/encomendas';
    const data = await res.json();
    return encomendaLandingPath(data?.role, data?.products);
  } catch {
    return '/encomendas';
  }
}
