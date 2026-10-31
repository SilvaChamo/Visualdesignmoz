/**
 * Última leitura da conta do painel VisualHost guardada no navegador (localStorage).
 * O painel abre logo com ela e atualiza por trás; o login do site guarda-a antes de entrar, para não haver ecrã
 * branco com o círculo depois das credenciais (pedido do Silva, 13/10/2026). Não tem palavras-passe; apaga-se ao
 * sair e quando a sessão é recusada.
 */
// 'vh-dados-2': as leituras guardadas antes de 13/10 podiam ter os dados inventados do local — ficam esquecidas
export const CACHE_DADOS_VHOST = 'vh-dados-2';

/** O utilizador da sessão aberta neste navegador (lido do cookie da sessão do Supabase, sem ir à rede); null se não se consegue ler */
export function utilizadorDaSessao(): string | null {
  try {
    const pedacos = new Map<string, string>();
    for (const c of document.cookie.split('; ')) {
      const i = c.indexOf('=');
      const nome = c.slice(0, i);
      if (/^sb-.+-auth-token(\.\d+)?$/.test(nome)) pedacos.set(nome, c.slice(i + 1));
    }
    const base = [...pedacos.keys()].map((k) => k.replace(/\.\d+$/, ''))[0];
    if (!base) return null;
    let v = pedacos.get(base) ?? '';
    if (!v) for (let n = 0; pedacos.has(`${base}.${n}`); n++) v += pedacos.get(`${base}.${n}`);
    v = decodeURIComponent(v);
    if (v.startsWith('base64-')) v = atob(v.slice(7).replace(/-/g, '+').replace(/_/g, '/'));
    const id = JSON.parse(v)?.user?.id;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

/** Guarda a leitura com o utilizador a quem pertence: a de outra conta nunca se mostra (ao entrar noutra conta no mesmo navegador, o painel
 *  mostrava primeiro os dados da conta anterior — o admin — e só depois trocava para os da conta nova; Silva, 27/10/2026) */
export function guardarDadosVhost(d: unknown) {
  try {
    localStorage.setItem(CACHE_DADOS_VHOST, JSON.stringify({ ...(d as object), __uid: utilizadorDaSessao() ?? '' }));
  } catch {}
}

/** A última leitura guardada, se for do utilizador da sessão actual (senão apaga-a e devolve null) */
export function lerDadosVhostGuardados<T>(): T | null {
  try {
    const v = localStorage.getItem(CACHE_DADOS_VHOST);
    if (!v) return null;
    const d = JSON.parse(v) as T & { __uid?: string | null };
    const agora = utilizadorDaSessao();
    // leitura guardada antes desta regra (sem o campo) ou de outro utilizador: não serve. Se o utilizador não se conseguiu ler ('' ou null),
    // não há como comparar e a leitura serve como sempre.
    if (d.__uid === undefined || (d.__uid && agora && d.__uid !== agora)) {
      apagarDadosVhost();
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

export function apagarDadosVhost() {
  try {
    localStorage.removeItem(CACHE_DADOS_VHOST);
  } catch {}
}

/** Lê /api/vhost/dados (com a sessão acabada de abrir) e guarda a resposta; devolve true se ficou guardada. */
export async function preCarregarDadosVhost(limiteMs = 30_000): Promise<boolean> {
  // a leitura de quem entrou antes neste navegador nunca serve para a conta nova
  apagarDadosVhost();
  try {
    const r = await fetch('/api/vhost/dados', { cache: 'no-store', credentials: 'include', signal: AbortSignal.timeout(limiteMs) });
    if (!r.ok) return false;
    guardarDadosVhost(await r.json());
    return true;
  } catch {
    return false;
  }
}

/** Começa a leitura do servidor (sem esperar nem receber dados) — o login chama isto ao abrir, para a leitura que
 *  preCarregarDadosVhost espera já estar feita, ou a meio, quando se carrega em "Entrar" */
export function aquecerDadosVhost() {
  fetch('/api/vhost/aquecer', { method: 'POST', cache: 'no-store' }).catch(() => {});
}

/** Por onde se entrou no painel (pedido do Silva, 13/10/2026): ao sair, quem entrou pelo login do site volta ao login do
 *  site; quem entrou pelo login do próprio painel volta ao login do painel */
const ENTRADA_LS = 'vh-entrada';
export type EntradaPainel = 'site' | 'painel';

export function marcarEntrada(origem: EntradaPainel) {
  try {
    localStorage.setItem(ENTRADA_LS, origem);
  } catch {}
}

/** Lê e esquece por onde se entrou (só serve para a saída seguinte) */
export function tirarEntrada(): EntradaPainel | null {
  try {
    const v = localStorage.getItem(ENTRADA_LS);
    localStorage.removeItem(ENTRADA_LS);
    return v === 'site' || v === 'painel' ? v : null;
  } catch {
    return null;
  }
}

/** Entrada pelo login do site (Silva, 27/10/2026): o login prepara as páginas enquanto o formulário processa e o painel abre já
 *  pronto, sem barras, sem página em branco e sem roda. Quem entra directamente pelo endereço do painel vê a roda enquanto o
 *  conteúdo se prepara. A marca é um cookie de 20 s (o servidor também a lê, para não esperar pelos dados) e sai logo que o painel abre. */
export const COOKIE_VIA_SITE = 'vh-via-site';

export function marcarViaSite() {
  try {
    document.cookie = `${COOKIE_VIA_SITE}=1; path=/; max-age=20; samesite=lax`;
  } catch {}
}

export function viaSiteAgora(): boolean {
  try {
    return typeof document !== 'undefined' && document.cookie.split('; ').includes(`${COOKIE_VIA_SITE}=1`);
  } catch {
    return false;
  }
}

export function limparViaSite() {
  try {
    document.cookie = `${COOKIE_VIA_SITE}=; path=/; max-age=0`;
  } catch {}
}

/** O administrador (ou quem tem mais do que uma conta) que acaba de comprar um plano abre o painel desse plano e não o seu principal: o checkout
 *  deixa esta marca (10 min) e o painel, ao ler os dados, passa para a conta do pedido que está à espera. */
const ABRIR_COMPRA_LS = 'vh-abrir-compra';
const ABRIR_COMPRA_CONTAS_LS = 'vh-abrir-compra-contas';
/** `contas`: os nomes das contas de hospedagem que a compra vai criar. O pedido pode esperar pela confirmação ou pela criação no servidor;
 *  assim que uma dessas contas existir, o administrador passa a vê-la (ver contaDaCompraPronta). */
export function pedirAbrirCompra(contas?: string[]) {
  try {
    localStorage.setItem(ABRIR_COMPRA_LS, String(Date.now()));
    const nomes = (contas || []).map((c) => c.trim()).filter(Boolean);
    if (nomes.length) localStorage.setItem(ABRIR_COMPRA_CONTAS_LS, JSON.stringify({ t: Date.now(), contas: nomes }));
  } catch {}
}
/** Das contas que a última compra ia criar, a primeira que já existe nos dados do painel; '' se nenhuma, ou se passou 1 h. Quem a usa chama limparAbrirCompra. */
export function contaDaCompraPronta(existentes: Record<string, unknown>): string {
  try {
    const g = JSON.parse(localStorage.getItem(ABRIR_COMPRA_CONTAS_LS) || 'null') as { t?: number; contas?: string[] } | null;
    if (!g || !Array.isArray(g.contas) || !g.t || Date.now() - g.t > 60 * 60_000) {
      localStorage.removeItem(ABRIR_COMPRA_CONTAS_LS);
      return '';
    }
    return g.contas.find((c) => existentes[c]) || '';
  } catch {
    return '';
  }
}
export function abrirCompraPedido(): boolean {
  try {
    const t = Number(localStorage.getItem(ABRIR_COMPRA_LS));
    return t > 0 && Date.now() - t < 10 * 60_000;
  } catch {
    return false;
  }
}
export function limparAbrirCompra() {
  try {
    localStorage.removeItem(ABRIR_COMPRA_LS);
    localStorage.removeItem(ABRIR_COMPRA_CONTAS_LS);
  } catch {}
}
