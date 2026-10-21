'use client';

/**
 * Ecrã do código de 2 passos (opcional, Silva, 21/10/2026): quem ligou a autenticação em 2 passos escreve aqui o código
 * da aplicação (Google Authenticator, Microsoft Authenticator…) depois de entrar com a palavra-passe. Sem a aplicação
 * (telemóvel perdido), entra com um código de recuperação de uso único — que desliga os 2 passos da conta.
 * Aparece no lugar do painel, no estilo da entrada, seja qual for a porta por onde se entrou.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import type { Lang } from './i18n';
import { Roda } from './entrada';
import { FundoPainel } from './triangulos';

const TXT = {
  pt: {
    titulo: 'Confirmar a entrada',
    texto: 'Escreva o código de 6 números da aplicação de autenticação.',
    codigo: 'Código',
    confirmar: 'Confirmar',
    sair: 'Sair',
    errado: 'Código errado ou expirado. Veja o código mais recente na aplicação.',
    falha: 'Não foi possível confirmar agora. Tente de novo.',
    semFator: 'Esta conta já não tem a autenticação em 2 passos ligada. Entre de novo.',
    semApp: 'Não tenho a aplicação — usar um código de recuperação',
    tituloRec: 'Código de recuperação',
    textoRec: 'Escreva um dos códigos de recuperação que guardou. Cada um só serve uma vez e, ao usá-lo, a autenticação em 2 passos desta conta fica desligada (volte a ligá-la depois, no Perfil).',
    voltarApp: 'Tenho a aplicação — escrever o código dela',
    recErrado: 'Código de recuperação errado ou já usado.',
  },
  en: {
    titulo: 'Confirm sign-in',
    texto: 'Enter the 6-digit code from your authenticator app.',
    codigo: 'Code',
    confirmar: 'Confirm',
    sair: 'Sign out',
    errado: 'Wrong or expired code. Check the latest code in the app.',
    falha: 'Could not confirm right now. Try again.',
    semFator: 'This account no longer has two-step verification on. Sign in again.',
    semApp: "I don't have the app — use a recovery code",
    tituloRec: 'Recovery code',
    textoRec: 'Enter one of the recovery codes you saved. Each works once and, when used, two-step verification is turned off for this account (turn it back on later, in Profile).',
    voltarApp: 'I have the app — enter its code',
    recErrado: 'Wrong or already used recovery code.',
  },
};

export function CodigoDoisPassos({ escuro, lang, onOk, onSair }: { escuro: boolean; lang: Lang; onOk: () => void; onSair: () => void }) {
  const tx = TXT[lang === 'en' ? 'en' : 'pt'];
  const [recuperar, setRecuperar] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [aVerificar, setAVerificar] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => campo.current?.focus(), [recuperar]);

  const confirmar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (aVerificar) return;
    setErro('');
    if (recuperar) {
      if (codigo.replace(/[^a-zA-Z0-9]/g, '').length < 8) return;
      setAVerificar(true);
      try {
        const r = await fetch('/api/vhost/doisp/recuperar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo }) });
        const j = (await r.json().catch(() => ({}))) as { erro?: string };
        if (!r.ok) {
          setErro(r.status === 429 && j.erro ? j.erro : tx.recErrado);
          setAVerificar(false);
          return;
        }
        // os 2 passos ficaram desligados: renova a sessão (já sem factor) e abre o painel
        await supabase.auth.refreshSession().catch(() => null);
        onOk();
      } catch {
        setErro(tx.falha);
        setAVerificar(false);
      }
      return;
    }
    const c = codigo.replace(/\s/g, '');
    if (!/^\d{6}$/.test(c)) return;
    setAVerificar(true);
    try {
      const { data: fs, error: eFs } = await supabase.auth.mfa.listFactors();
      if (eFs) throw eFs;
      const fator = fs?.totp?.[0];
      if (!fator) {
        setErro(tx.semFator);
        setAVerificar(false);
        return;
      }
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: c });
      if (error) {
        setErro(tx.errado);
        setCodigo('');
        setAVerificar(false);
        campo.current?.focus();
        return;
      }
      onOk();
    } catch {
      setErro(tx.falha);
      setAVerificar(false);
    }
  };
  // ao completar os 6 números da aplicação confirma sozinho
  useEffect(() => {
    if (!recuperar && /^\d{6}$/.test(codigo.replace(/\s/g, ''))) void confirmar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);
  const trocar = () => {
    setRecuperar(!recuperar);
    setCodigo('');
    setErro('');
  };
  return (
    <div className="ent">
      <FundoPainel escuro={escuro} />
      <div className="ent-meio">
        <form className="ent-cartao" onSubmit={confirmar} noValidate>
          <a className="ent-logo-link" href="/" title="VisualDesign">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="ent-logo" src={escuro ? '/assets/logo-entrada-escuro.png' : '/assets/logo-entrada.jpg'} alt="VisualDesign" />
          </a>
          <h2 className="ent-passo2-titulo">{recuperar ? tx.tituloRec : tx.titulo}</h2>
          <p className="ent-passo2-texto">{recuperar ? tx.textoRec : tx.texto}</p>
          <label htmlFor="ent-codigo">{tx.codigo}</label>
          <input
            ref={campo}
            id="ent-codigo"
            inputMode={recuperar ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={recuperar ? 16 : 7}
            placeholder={recuperar ? 'xxxxx-xxxxx' : '000000'}
            value={codigo}
            onChange={(e) => setCodigo(recuperar ? e.target.value.replace(/[^a-zA-Z0-9-]/g, '') : e.target.value.replace(/[^\d\s]/g, ''))}
            style={{ letterSpacing: recuperar ? '0.12em' : '0.35em', textAlign: 'center', fontSize: 20 }}
          />
          {erro && (
            <p className="ent-erro" role="alert">
              {erro}
            </p>
          )}
          <button className={'ent-botao' + (aVerificar ? ' a-entrar' : '')} type="submit" disabled={aVerificar} aria-busy={aVerificar}>
            {aVerificar ? <Roda tamanho={16} traco={2} /> : tx.confirmar}
          </button>
          <p className="ent-passo2-texto" style={{ margin: '14px 0 0' }}>
            <a onClick={trocar} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
              {recuperar ? tx.voltarApp : tx.semApp}
            </a>
          </p>
        </form>
        <small className="ent-voltar">
          <a onClick={onSair} style={{ cursor: 'pointer' }}>
            <i className="fa-solid fa-arrow-left" aria-hidden /> {tx.sair}
          </a>
        </small>
      </div>
    </div>
  );
}
