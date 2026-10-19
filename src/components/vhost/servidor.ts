// Dados reais do servidor que o painel recebe de /api/vhost/dados (lidos do Hestia e do Supabase).
// Só tipos e funções sem dependências de servidor: usado pelo painel e pela rota da API.
import type { Account } from './types';
import type { InfoConta, PacoteUtilizador } from './paginas/dados';

export interface ZonaDns {
  zona: string;
  dono: string;
  registos: number;
  dnssec: boolean;
  suspensa: boolean;
  criada: string;
}

export interface ServicoEstado {
  nome: string;
  ativo: boolean;
}

/** Estado do servidor (só para administradores) */
export interface Servidor {
  hostname: string;
  so: string;
  hestia: string;
  ligadoHa: string;
  ips: string[];
  cpus: number;
  carga: [number, number, number];
  memPct: number;
  memTotalGb: number;
  discoUsadoGb: number;
  discoTotalGb: number;
  /** tamanho de todos os discos (pode ser maior do que a partição, se esta ainda não foi alargada); 0 = desconhecido */
  discoFisicoGb?: number;
  /** consumo real do CPU (% de todos os núcleos, medido durante 1 s); -1 = desconhecido */
  cpuPct?: number;
  servicos: ServicoEstado[];
  nSites: number;
  nContas: number;
}

export interface DadosServidor {
  /** conta do servidor de quem tem sessão iniciada */
  me: string;
  /** quem entrou (perfil do site): nome, e-mail e empresa */
  pessoa?: Pessoa;
  contas: Record<string, Account>;
  pacotes: Record<string, PacoteUtilizador>;
  info: Record<string, InfoConta>;
  dns: ZonaDns[];
  servidor: Servidor | null;
  /** versões PHP instaladas no servidor */
  php: string[];
  lidoEm: string;
  /** há quanto tempo o servidor foi lido, contado no servidor quando a resposta saiu (só em /api/vhost/dados) */
  idadeMs?: number;
}

/** Quem tem a sessão iniciada, como está no perfil do site */
export interface Pessoa {
  nome: string;
  email: string;
  empresa: string;
}

/** Resposta de erro da API (sem sessão, sem acesso, servidor indisponível) */
export interface ErroDados {
  erro: string;
  codigo: 401 | 403 | 500;
}

/** Domínios internos do sistema (ferramentas da VisualDesign no servidor): não aparecem nos seletores nem nas
 *  listas de domínios do painel. Continuam no servidor. teste. e painel. ocultos a pedido do Silva (14/10/2026: "não
 *  precisamos de ver") — não se apagam: o teste. é o próprio site no Contabo. */
const DOMINIOS_INTERNOS = [
  /^files\.visualdesignmoz\.com$/i,
  /^supabase(-[a-z0-9]+)?\.visualdesignmoz\.com$/i,
  /^teste\.visualdesignmoz\.com$/i,
  /^painel\.visualdesignmoz\.com$/i,
];
export const dominioVisivel = (d: string) => !DOMINIOS_INTERNOS.some((r) => r.test(d));

/** "1,7 GB", "320 MB" a partir de MB */
export function mbTexto(mb: number): string {
  if (!mb) return '0 MB';
  if (mb >= 1024 * 1024) return (mb / 1024 / 1024).toFixed(1).replace('.', ',').replace(',0', '') + ' TB';
  if (mb >= 1024) return (mb / 1024).toFixed(1).replace('.', ',').replace(',0', '') + ' GB';
  return Math.round(mb) + ' MB';
}
