'use client';

/**
 * "Passar para outra conta": janela que mostra o que tem o domínio (visto agora no servidor), deixa escolher a conta
 * de destino e as bases de dados, e faz a passagem em segundo plano, a mostrar como vai (plano
 * VisualHost/07-plano-passar-dominios-entre-contas.md). Só para administradores e revendedores.
 */
import { Fragment, useEffect, useRef, useState } from 'react';
import type { VH } from '../context';
import { useVH } from '../context';
import { Check } from './componentes';
import { NovaConta } from './contas';

export type PrevisaoPassagem = {
  dominio: string;
  dono: string;
  site: boolean;
  ssl: boolean;
  dns: boolean;
  emails: number;
  wordpress: boolean;
  baseWp: string;
  bases: string[];
  todasBases: string[];
  ftp: string[];
  cron: number;
};
export type RespostaPrevisao =
  | { previsao: PrevisaoPassagem; existeNoutraConta: boolean; contaAdmin?: string; destinos: string[]; erro?: undefined }
  | { erro: string; previsao?: undefined; existeNoutraConta?: undefined; contaAdmin?: undefined; destinos?: undefined };
type Resultado = { ok: boolean; passos: string[]; avisos: string[]; erro?: string; de: string; para: string };

/** Quem pode passar domínios: administrador e revendedor */
export const podePassar = (vh: VH) => ['admin', 'revenda'].includes(vh.s.acc[vh.s.login]?.role || '');

export const lerPrevisao = (dominio: string): Promise<RespostaPrevisao> =>
  fetch('/api/vhost/passar?dominio=' + encodeURIComponent(dominio), { cache: 'no-store' })
    .then((r) => r.json() as Promise<RespostaPrevisao>)
    .catch(() => ({ erro: 'Sem ligação ao site.' }));

/** Começa a passagem e espera pelo fim (pergunta a cada 2 s); `aCorrer` recebe os segundos que já passaram */
export async function correrPassagem(dominio: string, para: string, bases: string[], aCorrer?: (s: number) => void): Promise<Resultado> {
  const r = await fetch('/api/vhost/passar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dominio, para, bases }) }).catch(() => null);
  const j = r ? ((await r.json().catch(() => ({}))) as { trabalho?: string; erro?: string }) : { erro: 'Sem ligação ao site.' };
  if (!j.trabalho) return { ok: false, passos: [], avisos: [], erro: j.erro || 'Não foi possível começar a passagem.', de: '', para };
  for (;;) {
    await new Promise((ok) => setTimeout(ok, 2000));
    const e = await fetch('/api/vhost/passar?trabalho=' + j.trabalho, { cache: 'no-store' })
      .then((x) => x.json() as Promise<{ feito?: boolean; segundos?: number; resultado?: Resultado; erro?: string }>)
      .catch(() => null);
    if (e?.erro) return { ok: false, passos: [], avisos: [], erro: e.erro, de: '', para };
    if (e?.feito && e.resultado) return e.resultado;
    if (e?.segundos !== undefined) aCorrer?.(e.segundos);
  }
}

/** O que passa com o domínio, em lista */
export function OQuePassa({ p }: { p: PrevisaoPassagem }) {
  const { t } = useVH();
  const itens = [
    p.site && (p.ssl ? 'Site, com o certificado SSL' : 'Site'),
    p.emails > 0 && p.emails + ' ' + (p.emails === 1 ? 'conta de e-mail' : 'contas de e-mail') + ' (com as palavras-passe)',
    p.dns && 'Zona DNS',
    p.wordpress && 'WordPress (fica a usar a base de dados com o nome novo)',
    p.ftp.length > 0 && 'FTP: ' + p.ftp.join(', '),
    p.cron > 0 && p.cron + ' tarefa(s) agendada(s)',
    p.site && 'Webmail em https://' + p.dominio + '/webmail',
  ].filter(Boolean) as string[];
  return (
    <ul className="passar-lista">
      {itens.map((x) => (
        <li key={x}>
          <i className="fa-solid fa-check" />
          {t(x)}
        </li>
      ))}
    </ul>
  );
}

export function BotaoPassar({ dominio, etiqueta, cor }: { dominio: string; etiqueta?: boolean; cor?: string }) {
  const vh = useVH();
  if (!podePassar(vh)) return null;
  return (
    <button className={(etiqueta ? 'btn g' : 'btn g sm') + (cor ? ' ' + cor : '')} title={vh.t('Passar para outra conta')} aria-label={vh.t('Passar para outra conta')} onClick={() => vh.openM(<PassarDominioModal dominio={dominio} />)}>
      <i className="fa-solid fa-right-left" />
      {etiqueta && vh.t('Passar para outra conta')}
    </button>
  );
}

export function PassarDominioModal({ dominio }: { dominio: string }) {
  const vh = useVH();
  const { t, closeM, toast, nav } = vh;
  const [r, setR] = useState<RespostaPrevisao | null>(null);
  const [para, setPara] = useState('');
  const [bases, setBases] = useState<string[]>([]);
  const [segundos, setSegundos] = useState<number | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);
  // «Nova conta…»: a janela passa a mostrar o formulário de criação de conta e volta aqui, com a conta nova escolhida
  const [aCriar, setACriar] = useState(false);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    lerPrevisao(dominio).then((j) => {
      if (!vivo.current) return;
      setR(j);
      if (!j.erro && j.previsao) {
        setBases(j.previsao.bases);
        setPara(j.destinos?.[0] || '');
      }
    });
    return () => {
      vivo.current = false;
    };
  }, [dominio]);

  const fechar = () => {
    closeM();
    if (res?.ok) {
      vh.recarregar(true);
      // o domínio já não é desta conta: volta à lista
      nav('/utilizador/dominios');
    }
  };
  // O servidor só responde no fim, sem passos pelo caminho: a barra enche-se por estimativa (depressa ao princípio, devagar perto do fim,
  // nunca passa dos 95 % antes de acabar); as bases de dados escolhidas alongam o tempo previsto.
  const previsto = 30 + 45 * bases.length;
  const percentagem = segundos === null ? 0 : Math.min(95, Math.round(100 * (1 - Math.exp(-segundos / previsto))));
  const contaCriada = (u: string) => {
    setACriar(false);
    setR(null);
    lerPrevisao(dominio).then((j) => {
      if (!vivo.current) return;
      setR(j);
      setPara(j.destinos?.includes(u) ? u : j.destinos?.[0] || '');
    });
  };
  const passar = async () => {
    if (!para) return toast('Escolha a conta de destino');
    setSegundos(0);
    const x = await correrPassagem(dominio, para, bases, (s) => vivo.current && setSegundos(s));
    if (!vivo.current) return;
    setRes(x);
    setSegundos(null);
    if (x.ok) toast(dominio + ' passou para ' + x.para);
  };

  if (!r)
    return (
      <>
        <h3>{t('Passar para outra conta')}</h3>
        <p className="passar-espera">
          <span className="passar-roda" /> {t('A ver o que tem o domínio…')}
        </p>
      </>
    );
  if (r.erro || r.existeNoutraConta || !r.previsao)
    return (
      <>
        <h3>{t('Passar para outra conta')}</h3>
        <p>{r.erro || t('Este domínio está numa conta fora do seu painel.')}</p>
        <div className="mfoot">
          <button className="btn g" onClick={closeM}>
            {t('Fechar')}
          </button>
        </div>
      </>
    );
  const p = r.previsao;
  if (aCriar)
    return (
      <>
        <h3>{t('Nova conta')}</h3>
        <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
          {t('Crie a conta para onde vai passar')} <b style={{ color: 'var(--ink)' }}>{p.dominio}</b>. {t('Depois de criada, volta aqui para concluir a passagem.')}
        </p>
        <NovaConta tipo="cliente" embutido={{ dominio: p.dominio, aoCriar: contaCriada, aoCancelar: () => setACriar(false) }} />
      </>
    );
  if (res)
    return (
      <>
        <h3>{res.ok ? t('Passou para') + ' ' + res.para : t('Não passou')}</h3>
        {res.erro && <p className="passar-erro">{res.erro}</p>}
        <ul className="passar-lista">
          {res.passos.map((x) => (
            <li key={x}>
              <i className="fa-solid fa-check" />
              {x}
            </li>
          ))}
          {res.avisos.map((x) => (
            <li key={x} className="aviso">
              <i className="fa-solid fa-triangle-exclamation" />
              {x}
            </li>
          ))}
        </ul>
        <div className="mfoot">
          <button className="btn r" onClick={fechar}>
            {t('Fechar')}
          </button>
        </div>
      </>
    );
  return (
    <>
      <h3>{t('Passar para outra conta')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
        <b style={{ color: 'var(--ink)' }}>{p.dominio}</b> {t('está na conta')} <b style={{ color: 'var(--ink)' }}>{p.dono}</b>.
      </p>
      <div className="f">
        <label>{t('Passar para a conta')}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={para} onChange={(e) => setPara(e.target.value)} disabled={segundos !== null} style={{ flex: 1 }}>
            {r.destinos.map((u) => (
              <option key={u} value={u}>
                {u}
                {vh.s.acc[u]?.name ? ' — ' + vh.s.acc[u].name : ''}
              </option>
            ))}
          </select>
          <button className="btn g" disabled={segundos !== null} onClick={() => setACriar(true)}>
            <i className="fa-solid fa-user-plus" />
            {t('Nova conta…')}
          </button>
        </div>
      </div>
      <div className="f">
        <label>{t('O que passa')}</label>
        <OQuePassa p={p} />
      </div>
      {p.todasBases.length > 0 && (
        <div className="f">
          <label>{t('Bases de dados que passam')}</label>
          <div className="passar-bases">
            {p.todasBases.map((b) => (
              <Fragment key={b}>
                <Check
                  checked={bases.includes(b)}
                  onChange={(v) => setBases(v ? [...bases, b] : bases.filter((x) => x !== b))}
                  label={b + (b === p.baseWp ? ' (WordPress)' : '')}
                />
                <span className={'passar-destino' + (bases.includes(b) ? '' : ' off')}>{para ? para + '_' + b.slice(p.dono.length + 1) : ''}</span>
              </Fragment>
            ))}
          </div>
        </div>
      )}
      <p className="passar-nota">
        {t('O site fica parado alguns segundos e o DNS não muda. Antes de começar guarda-se uma cópia; se algum passo falhar, volta tudo para trás.')}
      </p>
      <div className="fmda-up-campo passar-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentagem}>
        <div className="fmda-up-enche" style={{ width: percentagem + '%' }} />
        <b>{percentagem}%</b>
      </div>
      {segundos !== null && (
        <p className="passar-espera">
          {t('A passar…')} {segundos > 0 ? segundos + ' s' : ''} {t('(as bases de dados são copiadas; pode demorar alguns minutos)')}
        </p>
      )}
      <div className="mfoot">
        <button className="btn g" onClick={closeM} disabled={segundos !== null}>
          {t('Cancelar')}
        </button>
        <button className="btn r" onClick={passar} disabled={!para || segundos !== null}>
          <i className="fa-solid fa-right-left" />
          {t('Passar')}
        </button>
      </div>
    </>
  );
}
