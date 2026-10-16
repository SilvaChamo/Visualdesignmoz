// Leitura dos dados do painel VisualHost para quem tem sessão no site. Usada pela rota /api/vhost/dados e pela página
// do painel, que a desenha já no servidor: ao recarregar, o painel aparece logo, sem a página branca à espera do
// JavaScript (Silva, 16/10/2026).
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { lerServidor } from '@/lib/vhost-servidor';
import { lerRegisto, montarDados } from '@/lib/vhost-dados';
import type { DadosServidor } from '@/components/vhost/servidor';

export type LeituraPainel = { ok: true; dados: DadosServidor } | { ok: false; erro: string; codigo: 401 | 403 | 500 };

/** `fresco` lê já o servidor (só para administradores); sem ele, usa a leitura em memória (até 60 s) */
export async function lerDadosPainel(fresco = false): Promise<LeituraPainel> {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) {
    const codigo = auth.error.status === 401 ? 401 : 403;
    return { ok: false, codigo, erro: codigo === 401 ? 'Inicie sessão no site para ver o painel.' : 'Esta conta não tem acesso ao painel.' };
  }
  try {
    const [srv, reg] = await Promise.all([lerServidor(fresco && auth.user.role === 'admin'), lerRegisto()]);
    const dados = montarDados(srv, reg, { userId: auth.user.id, email: auth.user.email || '', role: auth.user.role });
    if (!dados.me || !dados.contas[dados.me])
      return { ok: false, codigo: 403, erro: 'A sua conta do site ainda não está ligada a uma conta do servidor.' };
    return { ok: true, dados };
  } catch (e) {
    console.error('[vhost/dados]', e);
    return { ok: false, codigo: 500, erro: 'Não foi possível ler o servidor. Tente de novo dentro de momentos.' };
  }
}
