'use client';

/**
 * Página de entrada do painel, no modelo da do DirectAdmin (pedido do Silva a 11/10: os clientes não devem notar a
 * troca). Só para entrar no painel: o registo e a recuperação da palavra-passe continuam no site. Fundo com a foto,
 * cartão com o logótipo horizontal da VisualDesign, Utilizador e Palavra-passe, botão Entrar, data e hora por baixo;
 *  em cima, à direita, um botão para alternar o tema e a língua. Entra pelo mesmo caminho do site (auth.signIn:
 * aceita o nome de utilizador ou o e-mail).
 */
import { useEffect, useRef, useState } from 'react';
import { auth, LoginNetworkError, LoginRateLimitError, MSG_LIGACAO } from '@/lib/supabase-client';
import type { Lang } from './i18n';
import { BarrasDa } from './carregador-da';
import { FundoPainel } from './triangulos';
import { marcarEntrada } from '@/lib/vhost-cache';

/** Língua escolhida na entrada ou no painel (fica guardada no navegador) */
export const LINGUA_LS = 'visualhost_lang';

const TXT = {
  pt: { user: 'Utilizador', userPh: 'Escreva o nome de utilizador ou e-mail', senha: 'Palavra-passe', senhaPh: 'Escreva a sua palavra-passe', entrar: 'Entrar', falta: 'Escreva o utilizador e a palavra-passe.', errado: 'Utilizador ou palavra-passe errados.', bloqueado: (min: number) => `Acesso temporariamente bloqueado por demasiadas tentativas de login falhadas. Aguarde ${min} minuto${min === 1 ? '' : 's'} antes de tentar novamente.`, ligacao: MSG_LIGACAO, mostrar: 'Mostrar a palavra-passe', esconder: 'Esconder a palavra-passe', claro: 'Tema claro', escuro: 'Tema escuro', voltar: 'Depois de entrar, volta a' },
  en: { user: 'Username', userPh: 'Please enter username or email', senha: 'Password', senhaPh: 'Please enter your password', entrar: 'Sign in', falta: 'Please enter your username and password.', errado: 'Wrong username or password.', bloqueado: (min: number) => `Sign-in temporarily blocked after too many failed attempts. Wait ${min} minute${min === 1 ? '' : 's'} before trying again.`, ligacao: { ip: 'No connection to the sign-in server: the server blocked access from your IP after too many failed attempts on this network (for example, an email app with an old password). Ask support to unblock the IP.', internet: 'No internet connection. Check your network and try again.', servidor: 'The sign-in server is not responding. Try again in a minute.' }, mostrar: 'Show password', esconder: 'Hide password', claro: 'Light theme', escuro: 'Dark theme', voltar: 'After signing in, you return to' },
};

export function EntradaPainel({ ocupado = false, escuro, lang, voltarA, onToggleTheme, onLang, onEntrou }: { ocupado?: boolean; escuro: boolean; lang: Lang; voltarA?: string; onToggleTheme: () => void; onLang: (l: Lang) => void; onEntrou: () => void }) {
  const tx = TXT[lang === 'en' ? 'en' : 'pt'];
  const [user, setUser] = useState('');
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [aEntrar, setAEntrar] = useState(false);
  const [erro, setErro] = useState('');
  // a hora só no navegador (a página também é desenhada no servidor, noutro fuso)
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    setAgora(new Date());
    const iv = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(iv);
  }, []);
  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.trim() || !senha) return setErro(tx.falta);
    setErro('');
    setAEntrar(true);
    try {
      // nome de utilizador (o do DA/Hestia): o servidor confirma a palavra-passe e diz o e-mail da conta; e-mail: direto
      const login = user.trim();
      let email = login;
      if (!login.includes('@')) {
        const r = await fetch('/api/vhost/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ utilizador: login, senha }) }).catch(() => null);
        const j = r ? ((await r.json().catch(() => ({}))) as { email?: string }) : {};
        if (r?.status === 429) {
          const retrySeconds = Number(r.headers.get('Retry-After')) || 15 * 60;
          setErro(tx.bloqueado(Math.max(1, Math.ceil(retrySeconds / 60))));
          setAEntrar(false);
          return;
        }
        // sem resposta ou servidor em baixo não é "palavra-passe errada"
        if (!r || r.status >= 500) {
          setErro(!r && navigator.onLine === false ? tx.ligacao.internet : tx.ligacao.servidor);
          setAEntrar(false);
          return;
        }
        if (!r.ok || !j.email) {
          setErro(tx.errado);
          setAEntrar(false);
          return;
        }
        email = j.email;
      }
      await auth.signIn(email, senha);
      marcarEntrada('painel'); // ao sair, volta a esta entrada
      onEntrou();
    } catch (error) {
      setErro(error instanceof LoginNetworkError ? tx.ligacao[error.tipo] : error instanceof LoginRateLimitError ? error.message : tx.errado);
      setAEntrar(false);
    }
  };
  const quando = agora ? agora.toLocaleDateString('pt-PT') + ', ' + agora.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div className="ent">
      <FundoPainel escuro={escuro} />
      <TopoEntrada escuro={escuro} lang={lang} onToggleTheme={onToggleTheme} onLang={onLang} />
      <div className="ent-meio">
        <form className="ent-cartao" onSubmit={entrar} noValidate>
          {/* o logótipo leva ao site da VisualDesign; no escuro, a versão com as letras brancas */}
          <a className="ent-logo-link" href="/" title="VisualDesign">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="ent-logo" src={escuro ? '/assets/logo-entrada-escuro.png' : '/assets/logo-entrada.jpg'} alt="VisualDesign" />
          </a>
          <label htmlFor="ent-user">{tx.user}</label>
          <input id="ent-user" autoComplete="username" autoCapitalize="none" spellCheck={false} value={user} onChange={(e) => setUser(e.target.value)} placeholder={tx.userPh} autoFocus />
          <label htmlFor="ent-senha">{tx.senha}</label>
          <div className="ent-senha">
            <input id="ent-senha" type={ver ? 'text' : 'password'} autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={tx.senhaPh} />
            <button type="button" onClick={() => setVer(!ver)} title={ver ? tx.esconder : tx.mostrar} aria-label={ver ? tx.esconder : tx.mostrar}>
              <i className={'fa-regular ' + (ver ? 'fa-eye-slash' : 'fa-eye')} />
            </button>
          </div>
          {erro && (
            <p className="ent-erro" role="alert">
              {erro}
            </p>
          )}
          {/* como no DA: a processar, o botão fica mais baixo (64 → 51 px, a largura não muda) com um arco pequeno a girar */}
          <button className={'ent-botao' + (aEntrar || ocupado ? ' a-entrar' : '')} type="submit" disabled={aEntrar || ocupado} aria-busy={aEntrar || ocupado}>
            {aEntrar || ocupado ? <Roda tamanho={16} traco={2} /> : tx.entrar}
          </button>
        </form>
        {/* como no DA: o caminho da página onde estava (sessão terminada, ou endereço aberto sem sessão), discreto no lugar
            da data e hora; volta lá depois de entrar */}
        {voltarA ? (
          <small className="ent-voltar">
            <i className="fa-solid fa-arrow-turn-up fa-rotate-90" aria-hidden />
            {tx.voltar} <b>{voltarA}</b>
          </small>
        ) : (
          <small className="ent-hora">{quando || '\u00a0'}</small>
        )}
      </div>
    </div>
  );
}

/** Canto superior direito da entrada: um botão para alternar o tema e o menu da língua. */
function TopoEntrada({ escuro, lang, onToggleTheme, onLang }: { escuro: boolean; lang: Lang; onToggleTheme: () => void; onLang: (l: Lang) => void }) {
  const tx = TXT[lang === 'en' ? 'en' : 'pt'];
  const [linguas, setLinguas] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!linguas) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setLinguas(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setLinguas(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [linguas]);
  return (
    <div className="ent-cima">
      <button
        type="button"
        className="ent-tema"
        onClick={onToggleTheme}
        title={escuro ? tx.claro : tx.escuro}
        aria-label={escuro ? tx.claro : tx.escuro}
      >
        <i className={'fa-solid ' + (escuro ? 'fa-sun' : 'fa-moon')} aria-hidden />
      </button>
      <div className="ent-lingua" ref={caixa}>
        <button type="button" onClick={() => setLinguas(!linguas)} aria-expanded={linguas}>
          <i className="fa-solid fa-globe" />
          {lang === 'en' ? 'English' : 'Português'}
        </button>
        {linguas && (
          <div className="ent-linguas">
            {(
              [
                ['pt', 'Português'],
                ['en', 'English'],
              ] as const
            ).map(([k, nome]) => (
              <button
                key={k}
                type="button"
                className={lang === k ? 'on' : ''}
                onClick={() => {
                  onLang(k);
                  setLinguas(false);
                }}
              >
                {nome}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Roda como a do DA (medida no vídeo do Silva): um arco que cresce e encolhe enquanto gira */
export function Roda({ tamanho, traco, grande }: { tamanho: number; traco: number; grande?: boolean }) {
  const meio = tamanho / 2;
  return (
    <svg className={'ent-roda' + (grande ? ' grande' : '')} width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} aria-hidden>
      <circle cx={meio} cy={meio} r={meio - traco / 2} fill="none" strokeWidth={traco} pathLength={100} />
    </svg>
  );
}

/** Depois de entrar pela entrada do painel: página branca com a roda a girar (como no DA). Sem a roda (ao recarregar,
 *  enquanto o painel ainda não tem os dados): as três barras do DA no fundo do tema — nunca a tela branca (Silva,
 *  16/10/2026) */
export function EsperaEntrada({ roda = true }: { roda?: boolean }) {
  return roda ? (
    <div className="ent-espera" role="status" aria-label="A abrir o painel">
      <Roda tamanho={97} traco={10} grande />
    </div>
  ) : (
    <div className="ent-espera sem-roda">
      <BarrasDa />
    </div>
  );
}
