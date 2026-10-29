// Leitura dos dados do painel VisualHost para quem tem sessão no site. Usada pela rota /api/vhost/dados e pela página
// do painel, que a desenha já no servidor: ao recarregar, o painel aparece logo, sem a página branca à espera do
// JavaScript (Silva, 16/10/2026).
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { LEITURA_FRESCA_MS, idadeLeitura, lerServidor, lerServidorParaPagina } from '@/lib/vhost-servidor';
import { lerRegisto, lerRegistoParaPagina, montarDados } from '@/lib/vhost-dados';
import { lerCompraPendente } from '@/lib/vhost-compra-pendente';
import type { DadosServidor } from '@/components/vhost/servidor';

export type LeituraPainel = { ok: true; dados: DadosServidor } | { ok: false; erro: string; codigo: 401 | 403 | 428 | 500 };

/** `fresco` lê já o servidor (só para administradores); sem ele, usa a leitura em memória (até 60 s).
 *  `paraPagina` (a página do painel desenhada no servidor): a última leitura que houver, mesmo mais antiga, sem esperar
 *  pelo Hestia nem pelo registo — a página vem logo com conteúdo e o painel lê a versão nova logo a seguir (a sessão
 *  verifica-se sempre agora) */
export async function lerDadosPainel(fresco = false, paraPagina = false): Promise<LeituraPainel> {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) {
    // 428: a conta tem os 2 passos ligados e a sessão ainda não escreveu o código
    if (auth.error.status === 428) return { ok: false, codigo: 428, erro: 'Escreva o código da aplicação de autenticação para continuar.' };
    const codigo = auth.error.status === 401 ? 401 : 403;
    return { ok: false, codigo, erro: codigo === 401 ? 'Inicie sessão no site para ver o painel.' : 'Esta conta não tem acesso ao painel.' };
  }
  try {
    const [srv, reg] = await Promise.all(
      paraPagina ? [lerServidorParaPagina(), lerRegistoParaPagina()] : [lerServidor(fresco && auth.user.role === 'admin'), lerRegisto()],
    );
    const sessao = { userId: auth.user.id, email: auth.user.email || '', role: auth.user.role };
    let dados = montarDados(srv, reg, sessao);
    // A conta não está numa leitura que já não é desta hora (a memória guarda até 60 min): pode ter sido criada há pouco
    // (ex.: por uma compra). Lê o servidor agora antes de dizer que não está ligada — no máximo uma leitura por minuto,
    // porque a seguinte já é fresca.
    let srvAtual = srv;
    let regAtual = reg;
    if ((!dados.me || !dados.contas[dados.me]) && idadeLeitura(srv) > LEITURA_FRESCA_MS) {
      srvAtual = await lerServidor(true);
      regAtual = paraPagina ? await lerRegisto() : reg;
      dados = montarDados(srvAtual, regAtual, sessao);
    }
    // Sem conta no servidor mas com uma compra a aguardar (confirmação do comprovativo, ou a conta ainda a ser criada): entra
    // no painel do pacote que comprou, com as configurações fechadas (conta provisória; nunca para a equipa)
    if ((!dados.me || !dados.contas[dados.me]) && auth.user.role !== 'admin') {
      const compra = await lerCompraPendente(auth.user.id);
      if (compra) dados = montarDados(srvAtual, regAtual, sessao, compra);
    }
    if (!dados.me || !dados.contas[dados.me])
      return { ok: false, codigo: 403, erro: 'A sua conta do site ainda não está ligada a uma conta do servidor.' };
    return { ok: true, dados };
  } catch (e) {
    console.error('[vhost/dados]', e);
    return { ok: false, codigo: 500, erro: 'Não foi possível ler o servidor. Tente de novo dentro de momentos.' };
  }
}
