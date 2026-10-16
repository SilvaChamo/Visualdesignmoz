/**
 * Última leitura da conta do painel VisualHost guardada no navegador (localStorage).
 * O painel abre logo com ela e atualiza por trás; o login do site guarda-a antes de entrar, para não haver ecrã
 * branco com o círculo depois das credenciais (pedido do Silva, 13/10/2026). Não tem palavras-passe; apaga-se ao
 * sair e quando a sessão é recusada.
 */
// 'vh-dados-2': as leituras guardadas antes de 13/10 podiam ter os dados inventados do local — ficam esquecidas
export const CACHE_DADOS_VHOST = 'vh-dados-2';

export function guardarDadosVhost(d: unknown) {
  try {
    localStorage.setItem(CACHE_DADOS_VHOST, JSON.stringify(d));
  } catch {}
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

/** O painel só se abre pelo login do site (pedido do Silva, 16/10/2026: pela entrada do próprio painel a sessão caía e
 *  as páginas diziam "Inicie sessão no site" logo depois de entrar; pelo login do site não). Endereço do login do site
 *  que, depois de entrar, volta a `caminho`. */
export function loginDoSite(caminho: string): string {
  return '/login?redirect=' + encodeURIComponent(caminho);
}

const LOGIN_SITE_SS = 'vh-login-site';
/** já a caminho do login do site (vários pedidos recusados ao mesmo tempo só mudam de página uma vez) */
let aCaminhoDoLogin = false;

/** Sem sessão, ou sessão recusada pelo servidor: vai para o login do site, que volta a esta página do painel. Nunca em
 *  ciclo: se já se foi lá há instantes e o painel voltou a recusar a sessão, fica onde está e devolve false. */
export function irParaLoginDoSite(): boolean {
  if (aCaminhoDoLogin) return true;
  if (!/^\/host(:|%3a)2026(\/|$)/i.test(window.location.pathname)) return false; // só a partir do painel
  try {
    if (Date.now() - (Number(sessionStorage.getItem(LOGIN_SITE_SS)) || 0) < 20_000) return false;
    sessionStorage.setItem(LOGIN_SITE_SS, String(Date.now()));
  } catch {}
  aCaminhoDoLogin = true;
  apagarDadosVhost();
  window.location.replace(loginDoSite(window.location.pathname));
  return true;
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
