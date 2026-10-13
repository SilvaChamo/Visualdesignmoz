'use client';

/**
 * Página de entrada do painel, no modelo da do DirectAdmin (pedido do Silva a 11/10: os clientes não devem notar a
 * troca). Só para entrar no painel: o registo e a recuperação da palavra-passe continuam no site. Fundo com a foto,
 * cartão com o logótipo horizontal da VisualDesign, Utilizador e Palavra-passe, botão Entrar, data e hora por baixo;
 * em cima, à direita, o modo (claro · automático · escuro) e a língua. Entra pelo mesmo caminho do site (auth.signIn:
 * aceita o nome de utilizador ou o e-mail).
 */
import { useEffect, useRef, useState } from 'react';
import { auth, LoginNetworkError, LoginRateLimitError, MSG_LIGACAO } from '@/lib/supabase-client';
import type { Lang } from './i18n';
import { FundoPainel } from './fundo-entrada';

export type ModoTema = 'light' | 'auto' | 'dark';

/** Língua escolhida na entrada ou no painel (fica guardada no navegador) */
export const LINGUA_LS = 'visualhost_lang';

const TXT = {
  pt: { user: 'Utilizador', userPh: 'Escreva o nome de utilizador ou e-mail', senha: 'Palavra-passe', senhaPh: 'Escreva a sua palavra-passe', entrar: 'Entrar', falta: 'Escreva o utilizador e a palavra-passe.', errado: 'Utilizador ou palavra-passe errados.', bloqueado: (min: number) => `Acesso temporariamente bloqueado por demasiadas tentativas de login falhadas. Aguarde ${min} minuto${min === 1 ? '' : 's'} antes de tentar novamente.`, ligacao: MSG_LIGACAO, mostrar: 'Mostrar a palavra-passe', esconder: 'Esconder a palavra-passe', claro: 'Claro', auto: 'Automático', escuro: 'Escuro', voltar: 'Depois de entrar, volta a' },
  en: { user: 'Username', userPh: 'Please enter username or email', senha: 'Password', senhaPh: 'Please enter your password', entrar: 'Sign in', falta: 'Please enter your username and password.', errado: 'Wrong username or password.', bloqueado: (min: number) => `Sign-in temporarily blocked after too many failed attempts. Wait ${min} minute${min === 1 ? '' : 's'} before trying again.`, ligacao: { ip: 'No connection to the sign-in server: the server blocked access from your IP after too many failed attempts on this network (for example, an email app with an old password). Ask support to unblock the IP.', internet: 'No internet connection. Check your network and try again.', servidor: 'The sign-in server is not responding. Try again in a minute.' }, mostrar: 'Show password', esconder: 'Hide password', claro: 'Light', auto: 'Auto', escuro: 'Dark', voltar: 'After signing in, you return to' },
};

export function EntradaPainel({ ocupado = false, escuro, modo, lang, voltarA, onModo, onLang, onEntrou }: { ocupado?: boolean; escuro: boolean; modo: ModoTema; lang: Lang; voltarA?: string; onModo: (m: ModoTema) => void; onLang: (l: Lang) => void; onEntrou: () => void }) {
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
      <TopoEntrada modo={modo} lang={lang} onModo={onModo} onLang={onLang} />
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

/** Canto superior direito da entrada: modo claro · automático · escuro e a língua, num menu encostado à direita do ecrã
 *  como no DA (mais estreito) */
function TopoEntrada({ modo, lang, onModo, onLang }: { modo: ModoTema; lang: Lang; onModo: (m: ModoTema) => void; onLang: (l: Lang) => void }) {
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
      <div className="ent-modos" role="radiogroup" aria-label="Tema">
        {(
          [
            ['light', 'fa-sun', tx.claro],
            ['auto', 'fa-circle-half-stroke', tx.auto],
            ['dark', 'fa-moon', tx.escuro],
          ] as const
        ).map(([m, fa, nome]) => (
          <button key={m} type="button" role="radio" aria-checked={modo === m} className={modo === m ? 'on' : ''} onClick={() => onModo(m)} title={nome} aria-label={nome}>
            <i className={'fa-solid ' + fa} />
          </button>
        ))}
      </div>
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
function Roda({ tamanho, traco }: { tamanho: number; traco: number }) {
  const meio = tamanho / 2;
  return (
    <svg className="ent-roda" width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} aria-hidden>
      <circle cx={meio} cy={meio} r={meio - traco / 2} fill="none" strokeWidth={traco} pathLength={100} />
    </svg>
  );
}
