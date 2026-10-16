// Painel VisualHost. Ícones (Font Awesome) e estilos só carregam nesta parte do site.
// O painel vive no layout para não perder o estado ao mudar de ecrã (/host:2026/admin, /host:2026/admin/dns, …).
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@/components/vhost/generated/maquete.css';
import '@/components/vhost/paginas/paginas.css';
import { VisualHostApp } from '@/components/vhost/VisualHostApp';
import { versaoBuild } from '@/lib/versao-build';
import { lerDadosPainel, type LeituraPainel } from '@/lib/vhost-dados-painel';
import { COOKIE_TEMA, temaDoCookie, type TemaConta } from '@/lib/vhost-tema-conta';
import { CarregadorDa } from '@/components/vhost/carregador-da';

export const metadata = {
  title: 'VisualHost',
  description: 'Painel de alojamento da VisualDesign',
};

// Antes de o painel aparecer (evita piscar em branco): sem o tema da conta no cookie (primeira vez neste navegador), o
// modo escolhido na entrada; e a página toda no modo do painel, barras de deslocamento incluídas (o painel faz o mesmo
// depois de ligado)
const temaScript = (doLogin: boolean) =>
  `try{var e=document.querySelector('.vh:not(.vh-carga)');if(e){${doLogin ? "var t=localStorage.getItem('visualhost_theme');if(t==='auto')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';if(t==='dark'||t==='light')e.dataset.theme=t;" : ''}var d=e.dataset.theme==='dark',h=document.documentElement;h.classList.toggle('dark',d);h.style.colorScheme=d?'dark':'light'}}catch(e){}`;

/** Quanto a página espera pelos dados no servidor. Normalmente vêm logo (a última leitura fica em memória — ver
 *  lerDadosPainel); só depois de o site arrancar é que é preciso ler o servidor. Enquanto se espera, vê-se a página
 *  anterior ou o carregador do DA; se demorar mais, o painel abre com a última leitura guardada no navegador. */
const ESPERA_DADOS_MS = 3000;

/** Entrada do painel: só pelo login do site (Silva, 16/10/2026), que volta aqui depois de entrar */
const LOGIN_DO_SITE = '/login?redirect=' + encodeURIComponent('/host:2026');

export default async function VisualHostLayout({ children }: { children: React.ReactNode }) {
  // o proxy já manda para o login quem chega sem cookie de sessão; isto cobre o resto
  const jar = await cookies();
  const temSessao = jar.getAll().some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name));
  if (!temSessao) redirect(LOGIN_DO_SITE);
  // tema da própria conta guardado pelo painel neste navegador (cookie)
  const doCookie = temaDoCookie(jar.get(COOKIE_TEMA)?.value);
  // A página sai logo com o carregador do DA (as três barras, no fundo e na cor do tema da conta) e o painel entra no
  // lugar dele quando os dados chegam: nunca a tela branca ao recarregar (Silva, 16/10/2026). Se chegarem depressa, o
  // navegador continua a mostrar a página anterior até ao painel e as barras nem se veem.
  return (
    <>
      <Suspense fallback={<CarregadorDa tema={doCookie?.tema} />}>
        <PainelComDados doCookie={doCookie} />
      </Suspense>
      {children}
    </>
  );
}

/** O painel já com os dados da conta (lidos no servidor) e o tema dela */
async function PainelComDados({ doCookie }: { doCookie: { conta: string; tema: TemaConta } | null }) {
  // Dados já no HTML: ao recarregar, o painel aparece logo com o conteúdo, sem a página branca enquanto o navegador
  // carrega o JavaScript (Silva, 16/10/2026: "quando faço refresh, a página fica com a tela branca")
  // (sessão recusada: o painel termina-a no navegador e vai para o login — daqui não, que uma falha passageira do
  // servidor de autenticação fazia andar às voltas entre o login e o painel)
  const leitura = await Promise.race<LeituraPainel | null>([
    lerDadosPainel(false, true).catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), ESPERA_DADOS_MS)),
  ]);
  const dados = leitura?.ok ? leitura.dados : null;
  // o tema do cookie só se for da conta que entrou
  const tema = doCookie && (!dados || doCookie.conta === dados.me) ? doCookie.tema : null;
  return (
    <>
      {/* a versão do servidor que desenhou esta página: o painel compara-a com /api/versao para passar sozinho para
          a versão nova depois de uma publicação */}
      <VisualHostApp versao={versaoBuild()} dados={dados} tema={tema} />
      <script dangerouslySetInnerHTML={{ __html: temaScript(!tema) }} />
    </>
  );
}
