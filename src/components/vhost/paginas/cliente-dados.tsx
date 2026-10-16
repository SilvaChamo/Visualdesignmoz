'use client';

/**
 * "Editar dados" de um cliente (plano VisualHost/07-plano-passar-dominios-entre-contas.md, ponto 4): nome, empresa,
 * telefone, morada, cidade, NUIT e e-mail de contacto. Grava no perfil do site e no Hestia ao mesmo tempo
 * (/api/vhost/cliente) e deixa ligar o perfil à conta de alojamento. O próprio cliente continua a poder mudar os
 * seus dados em Perfil → Dados pessoais.
 */
import { useEffect, useRef, useState } from 'react';
import { useVH } from '../context';

type Dados = { conta: string; ligado: boolean; perfil: Record<string, string> | null; servidor: { nome: string; email: string }; podeLigar: boolean };

const CAMPOS: [string, string, string][] = [
  ['name', 'Nome', ''],
  ['empresa', 'Empresa', ''],
  ['telefone', 'Telefone', ''],
  ['morada', 'Morada', ''],
  ['cidade', 'Cidade', ''],
  ['nuit', 'NUIT', ''],
];

async function pedir(corpo: Record<string, unknown>) {
  const r = await fetch('/api/vhost/cliente', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).catch(() => null);
  const j = r ? ((await r.json().catch(() => ({}))) as { ok?: boolean; erro?: string; feito?: string[]; avisos?: string[]; conta?: string }) : { erro: 'Sem ligação ao site.' };
  return { ok: !!r?.ok, ...j };
}

export function EditarDadosModal({ conta }: { conta: string }) {
  const vh = useVH();
  const { t, closeM, toast } = vh;
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState('');
  const [f, setF] = useState<Record<string, string>>({});
  const [nomeConta, setNomeConta] = useState(conta);
  const [aRenomear, setARenomear] = useState(false);
  const [email, setEmail] = useState('');
  const [emailLigar, setEmailLigar] = useState('');
  const [aGravar, setAGravar] = useState(false);
  const vivo = useRef(true);

  const ler = () =>
    fetch('/api/vhost/cliente?conta=' + encodeURIComponent(conta), { cache: 'no-store' })
      .then(async (r) => ({ r, j: (await r.json().catch(() => ({}))) as Dados & { erro?: string } }))
      .then(({ r, j }) => {
        if (!vivo.current) return;
        if (!r.ok) return setErro(j.erro || 'Não foi possível ler os dados.');
        setD(j);
        setF({ ...(j.perfil || {}), name: j.perfil?.name || j.servidor.nome || '' });
        setEmail(j.servidor.email || '');
      })
      .catch(() => vivo.current && setErro('Sem ligação ao site.'));

  useEffect(() => {
    vivo.current = true;
    void ler();
    return () => {
      vivo.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conta]);

  const gravar = async () => {
    setAGravar(true);
    const x = await pedir({ acao: 'dados', conta, ...Object.fromEntries(CAMPOS.map(([k]) => [k, f[k] || ''])), email });
    if (!vivo.current) return;
    setAGravar(false);
    if (!x.ok) return toast(x.erro || (x.avisos || []).join(' ') || 'Não foi possível gravar.');
    toast('Dados de ' + conta + ' gravados (' + (x.feito || []).join(', ') + ')' + (x.avisos?.length ? '. ' + x.avisos.join(' ') : ''));
    await vh.recarregar(true);
    closeM();
  };
  const ligar = async () => {
    const x = await pedir({ acao: 'ligar', conta, email: emailLigar });
    if (!vivo.current) return;
    if (!x.ok) return toast(x.erro || 'Não foi possível ligar.');
    toast('Perfil ligado à conta ' + conta);
    await ler();
  };

  if (erro)
    return (
      <>
        <h3>{t('Editar dados')}</h3>
        <p className="passar-erro">{erro}</p>
        <div className="mfoot">
          <button className="btn g" onClick={closeM}>
            {t('Fechar')}
          </button>
        </div>
      </>
    );
  if (!d)
    return (
      <>
        <h3>{t('Editar dados')}</h3>
        <p className="passar-espera">
          <span className="passar-roda" /> {t('A ler os dados…')}
        </p>
      </>
    );
  return (
    <>
      <h3>
        {t('Editar dados')} · {conta}
      </h3>
      {!d.ligado && (
        <div className="passar-aviso-dom" style={{ marginBottom: 12 }}>
          <i className="fa-solid fa-link-slash" />
          <div>
            {t('Esta conta ainda não está ligada a um perfil do site. Ligada, o cliente vê a sua conta ao entrar no painel.')}
            {d.podeLigar && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input style={{ flex: 1 }} type="email" placeholder={t('E-mail de entrada do cliente no site')} value={emailLigar} onChange={(e) => setEmailLigar(e.target.value)} />
                <button className="btn g" disabled={!emailLigar.includes('@')} onClick={ligar}>
                  <i className="fa-solid fa-link" />
                  {t('Ligar')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {d.podeLigar && (
        <div className="f">
          <label>{t('Identificador da conta (username)')}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              style={{ flex: 1 }}
              value={nomeConta}
              onChange={(e) => setNomeConta(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              placeholder={conta}
              disabled={aRenomear}
            />
            {nomeConta !== conta && nomeConta.length >= 3 && (
              <button
                type="button"
                className="btn r sm"
                style={{ flexShrink: 0 }}
                disabled={aRenomear}
                onClick={async () => {
                  setARenomear(true);
                  const x = await pedir({ acao: 'renomear-conta', conta, novoNome: nomeConta });
                  setARenomear(false);
                  if (!x.ok) return toast(x.erro || 'Erro ao renomear conta.');
                  toast('Conta renomeada com sucesso para ' + (x.conta || nomeConta));
                  await vh.recarregar(true);
                  closeM();
                }}
              >
                <i className="fa-solid fa-pen-to-square" />
                {t(aRenomear ? 'A renomear…' : 'Renomear conta')}
              </button>
            )}
          </div>
        </div>
      )}
      {CAMPOS.map(([k, rotulo]) => (
        <div className="f" key={k}>
          <label>{t(rotulo)}</label>
          <input value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} disabled={!d.ligado && k !== 'name'} />
        </div>
      ))}
      <div className="f">
        <label>{t('E-mail de contacto da conta')}</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <p className="passar-nota">{t('O e-mail de entrada do cliente no site não muda aqui. O nome e o e-mail de contacto mudam também no servidor.')}</p>
      <div className="mfoot">
        <button className="btn g" onClick={closeM} disabled={aGravar}>
          {t('Cancelar')}
        </button>
        <button className="btn r" onClick={gravar} disabled={aGravar || (f.name || '').trim().length < 2}>
          <i className="fa-solid fa-floppy-disk" />
          {t('Guardar')}
        </button>
      </div>
    </>
  );
}
