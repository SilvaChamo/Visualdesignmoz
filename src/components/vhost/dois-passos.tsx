'use client';

/**
 * Ecrã do código de 2 passos (opcional, Silva, 21/10/2026): quem ligou a autenticação em 2 passos escreve aqui o código
 * da aplicação (Google Authenticator, Microsoft Authenticator…) depois de entrar com a palavra-passe. Aparece no lugar
 * do painel, no estilo da entrada, seja qual for a porta por onde se entrou (login do site ou do próprio painel).
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import type { Lang } from './i18n';
import { Roda } from './entrada';
import { FundoPainel } from './triangulos';

const TXT = {
  pt: { titulo: 'Confirmar a entrada', texto: 'Escreva o código de 6 números da aplicação de autenticação.', codigo: 'Código', confirmar: 'Confirmar', sair: 'Sair', errado: 'Código errado ou expirado. Veja o código mais recente na aplicação.', falha: 'Não foi possível confirmar agora. Tente de novo.', semFator: 'Esta conta já não tem a autenticação em 2 passos ligada. Entre de novo.' },
  en: { titulo: 'Confirm sign-in', texto: 'Enter the 6-digit code from your authenticator app.', codigo: 'Code', confirmar: 'Confirm', sair: 'Sign out', errado: 'Wrong or expired code. Check the latest code in the app.', falha: 'Could not confirm right now. Try again.', semFator: 'This account no longer has two-step verification on. Sign in again.' },
};

export function CodigoDoisPassos({ escuro, lang, onOk, onSair }: { escuro: boolean; lang: Lang; onOk: () => void; onSair: () => void }) {
  const tx = TXT[lang === 'en' ? 'en' : 'pt'];
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [aVerificar, setAVerificar] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => campo.current?.focus(), []);
  const confirmar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const c = codigo.replace(/\s/g, '');
    if (!/^\d{6}$/.test(c) || aVerificar) return;
    setErro('');
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
  // ao completar os 6 números confirma sozinho
  useEffect(() => {
    if (/^\d{6}$/.test(codigo.replace(/\s/g, ''))) void confirmar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);
  return (
    <div className="ent">
      <FundoPainel escuro={escuro} />
      <div className="ent-meio">
        <form className="ent-cartao" onSubmit={confirmar} noValidate>
          <a className="ent-logo-link" href="/" title="VisualDesign">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="ent-logo" src={escuro ? '/assets/logo-entrada-escuro.png' : '/assets/logo-entrada.jpg'} alt="VisualDesign" />
          </a>
          <h2 className="ent-passo2-titulo">{tx.titulo}</h2>
          <p className="ent-passo2-texto">{tx.texto}</p>
          <label htmlFor="ent-codigo">{tx.codigo}</label>
          <input
            ref={campo}
            id="ent-codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="000000"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/[^\d\s]/g, ''))}
            style={{ letterSpacing: '0.35em', textAlign: 'center', fontSize: 20 }}
          />
          {erro && (
            <p className="ent-erro" role="alert">
              {erro}
            </p>
          )}
          <button className={'ent-botao' + (aVerificar ? ' a-entrar' : '')} type="submit" disabled={aVerificar} aria-busy={aVerificar}>
            {aVerificar ? <Roda tamanho={16} traco={2} /> : tx.confirmar}
          </button>
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
