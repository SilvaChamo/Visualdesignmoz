// Painel VisualHost. Ícones (Font Awesome) e estilos só carregam nesta parte do site.
// O painel vive no layout para não perder o estado ao mudar de ecrã (/host:2026/admin, /host:2026/admin/dns, …).
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@/components/vhost/generated/maquete.css';
import '@/components/vhost/paginas/paginas.css';
import { VisualHostApp } from '@/components/vhost/VisualHostApp';
import { versaoBuild } from '@/lib/versao-build';
import { lerDadosPainel, type LeituraPainel } from '@/lib/vhost-dados-painel';

export const metadata = {
  title: 'VisualHost',
  description: 'Painel de alojamento da VisualDesign',
};

// Aplica o tema escuro guardado antes de o painel aparecer (evita piscar em branco)
const THEME_SCRIPT = `try{var t=localStorage.getItem('visualhost_theme');var e=document.querySelector('.vh');if(t&&e)e.dataset.theme=t}catch(e){}`;

/** Quanto a página espera pelos dados no servidor; se demorarem mais (leitura do servidor fora da memória), o painel
 *  abre com a última leitura guardada no navegador e lê-os lá, como antes */
const ESPERA_DADOS_MS = 1500;

/** Entrada do painel: só pelo login do site (Silva, 16/10/2026), que volta aqui depois de entrar */
const LOGIN_DO_SITE = '/login?redirect=' + encodeURIComponent('/host:2026');

export default async function VisualHostLayout({ children }: { children: React.ReactNode }) {
  // o proxy já manda para o login quem chega sem cookie de sessão; isto cobre o resto
  const temSessao = (await cookies()).getAll().some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name));
  if (!temSessao) redirect(LOGIN_DO_SITE);
  // Dados já no HTML: ao recarregar, o painel aparece logo com o conteúdo, sem a página branca enquanto o navegador
  // carrega o JavaScript (Silva, 16/10/2026: "quando faço refresh, a página fica com a tela branca")
  // (sessão recusada: o painel termina-a no navegador e vai para o login — daqui não, que uma falha passageira do
  // servidor de autenticação fazia andar às voltas entre o login e o painel)
  const leitura = await Promise.race<LeituraPainel | null>([
    lerDadosPainel().catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), ESPERA_DADOS_MS)),
  ]);
  return (
    <>
      {/* a versão do servidor que desenhou esta página: o painel compara-a com /api/versao para passar sozinho para
          a versão nova depois de uma publicação */}
      <VisualHostApp versao={versaoBuild()} dados={leitura?.ok ? leitura.dados : null} />
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      {children}
    </>
  );
}
