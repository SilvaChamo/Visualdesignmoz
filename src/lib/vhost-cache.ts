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
