'use client';

// Pacotes de cliente e de revenda: listas, criar e editar (campos do DirectAdmin — ver 04-da-gestao-de-contas.md).
import { useRef, useState } from 'react';
import { useVH, type VH } from '../context';
import { THEME_PRESETS } from '../theme';
import { noServidorDetalhe } from './acoes';
import type { ScreenFn } from '../screens';
import { Check, DataTable, Frm, Funcionalidades, Limites, Row, type Col } from './componentes';
import {
  ACME,
  FUNC_REVENDA,
  FUNC_UTILIZADOR,
  IDIOMAS,
  LIMITES_HESTIA,
  LIMITES_REVENDA,
  LIMITES_UTILIZADOR,
  MODELOS_BACKEND,
  MODELOS_DNS,
  MODELOS_PROXY,
  MODELOS_WEB,
  RECURSOS,
  comExtras,
  extrasDoPacote,
  limTxt,
  pacoteRevendaVazio,
  pacoteVazio,
  type Lim,
  type PacoteRevenda,
  type PacoteUtilizador,
} from './dados';
import { SHELLS_HESTIA } from '@/lib/pacote-hestia';

const SHELL_ROTULOS: Record<string, string> = {
  nologin: 'Sem acesso (nologin)',
  bash: 'SSH normal (bash)',
  rbash: 'SSH restrito (rbash)',
  jailbash: 'SSH isolado (jailbash)',
  sh: 'sh',
  dash: 'dash',
  screen: 'screen',
  tmux: 'tmux',
};

type Tipo = 'cliente' | 'revenda';
const set = <T extends object>(o: T, k: keyof T, v: unknown): T => ({ ...o, [k]: v });

/** Secções do pacote de cliente (limites, funcionalidades, definições, ACME, recursos) */
export function FormPacoteUtilizador({ value, onChange, conta }: { value: PacoteUtilizador; onChange: (p: PacoteUtilizador) => void; conta?: boolean }) {
  const { t } = useVH();
  return (
    <>
      <Frm title="Limites" desc={conta ? 'Mudar os limites desta conta' : 'O que cada conta com este pacote pode usar'}>
        <Limites campos={LIMITES_UTILIZADOR} lim={value.lim} set={(k, l) => onChange(set(value, 'lim', { ...value.lim, [k]: l }))} />
      </Frm>
      {!conta && (
        <Frm title="Limites do servidor" desc="Domínios de e-mail e DNS, tarefas agendadas, cópias de segurança e envio de e-mail (gravam-se no pacote do servidor)">
          <Limites
            campos={LIMITES_HESTIA}
            lim={value.lim}
            set={(k, l) => {
              // o limite de tarefas e de DNS e o "ligado/desligado" da funcionalidade são a mesma coisa
              const liga = (x: Lim) => x.unl || Number(x.v) > 0;
              const feats = k === 'cronjobs' ? { ...value.feats, cron: liga(l) } : k === 'dnsdomains' ? { ...value.feats, dns: liga(l) } : value.feats;
              onChange({ ...value, lim: { ...value.lim, [k]: l }, feats });
            }}
          />
        </Frm>
      )}
      <Frm title="Funcionalidades" desc={conta ? 'Ligar ou desligar funcionalidades desta conta' : 'O que a conta vê no menu'}>
        <Funcionalidades
          campos={FUNC_UTILIZADOR}
          feats={value.feats}
          set={(k, v) => {
            const feats = { ...value.feats, [k]: v };
            if (conta) return onChange(set(value, 'feats', feats));
            // no pacote do servidor, o SSH, o cron e o DNS são o shell e os limites: mudam juntos
            const lim = { ...value.lim };
            const hestia = { ...(value.hestia || {}) };
            if (k === 'ssh' || k === 'jail') {
              if (k === 'jail' && v) feats.ssh = true;
              hestia.SHELL = feats.ssh ? (feats.jail ? 'jailbash' : 'bash') : 'nologin';
              if (!feats.ssh) feats.jail = false;
            }
            if (k === 'cron') lim.cronjobs = v ? (lim.cronjobs?.unl || Number(lim.cronjobs?.v) > 0 ? lim.cronjobs : { v: '', unl: true }) : { v: '0', unl: false };
            if (k === 'dns') lim.dnsdomains = v ? (lim.dnsdomains?.unl || Number(lim.dnsdomains?.v) > 0 ? lim.dnsdomains : { v: '', unl: true }) : { v: '0', unl: false };
            onChange({ ...value, feats, lim, hestia });
          }}
        />
      </Frm>
      {!conta && (
        <Frm title="Definições do servidor" desc="Acesso por linha de comandos, servidores de nomes, cópias incrementais e modelos (gravam-se no pacote do servidor)">
          <Row label="Acesso por linha de comandos (shell)" hint="Sem acesso, SSH normal, restrito ou isolado.">
            <select
              value={value.hestia?.SHELL || 'nologin'}
              onChange={(e) => {
                const shell = e.target.value;
                onChange({
                  ...value,
                  hestia: { ...(value.hestia || {}), SHELL: shell },
                  feats: { ...value.feats, ssh: shell !== 'nologin', jail: shell === 'jailbash' },
                });
              }}
            >
              {SHELLS_HESTIA.map((x) => (
                <option key={x} value={x}>
                  {SHELL_ROTULOS[x] || x}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Servidores de nomes (NS)" hint="Separados por vírgulas, por ordem. Ex.: ns3.visualdesignmoz.com,ns4.visualdesignmoz.com">
            <input value={value.hestia?.NS || ''} onChange={(e) => onChange({ ...value, hestia: { ...(value.hestia || {}), NS: e.target.value } })} />
          </Row>
          <Row label="Cópias de segurança incrementais" hint="Sim: guarda só o que mudou desde a última cópia.">
            <select value={value.hestia?.BACKUPS_INCREMENTAL || 'no'} onChange={(e) => onChange({ ...value, hestia: { ...(value.hestia || {}), BACKUPS_INCREMENTAL: e.target.value } })}>
              <option value="no">Não</option>
              <option value="yes">Sim</option>
            </select>
          </Row>
          {(
            [
              ['WEB_TEMPLATE', 'Modelo do site', MODELOS_WEB],
              ['PROXY_TEMPLATE', 'Modelo do proxy', MODELOS_PROXY],
              ['BACKEND_TEMPLATE', 'Modelo do PHP', MODELOS_BACKEND],
              ['DNS_TEMPLATE', 'Modelo do DNS', MODELOS_DNS],
            ] as const
          ).map(([k, rotulo, opcoes]) => (
            <Row key={k} label={rotulo} hint="Os sites novos desta conta nascem com este modelo.">
              <input list={'vh-' + k} value={value.hestia?.[k] || ''} placeholder="default" onChange={(e) => onChange({ ...value, hestia: { ...(value.hestia || {}), [k]: e.target.value } })} />
              <datalist id={'vh-' + k}>
                {opcoes.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </Row>
          ))}
        </Frm>
      )}
      <Frm title="Definições adicionais">
        {/* os temas do painel (Personalizar): ao escolher, as contas deste plano abrem com ele (Silva, 16/10/2026) */}
        <Row label="Tema">
          <select value={THEME_PRESETS.some((x) => x.id === value.tema) ? value.tema : 'visualdesign'} onChange={(e) => onChange(set(value, 'tema', e.target.value))}>
            {THEME_PRESETS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Idioma">
          <select value={value.idioma} onChange={(e) => onChange(set(value, 'idioma', e.target.value))}>
            {IDIOMAS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Row>
        <Row label="Fornecedor de certificados (ACME)" hint="Passa a ser o fornecedor predefinido das contas com este pacote.">
          <select value={value.acme} onChange={(e) => onChange(set(value, 'acme', e.target.value))}>
            {ACME.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Row>
      </Frm>
      <Frm title="Limites de recursos" desc={t('Processador, disco e memória que a conta pode usar')}>
        <Limites campos={RECURSOS} lim={value.rec} set={(k, l) => onChange(set(value, 'rec', { ...value.rec, [k]: l }))} />
      </Frm>
    </>
  );
}

/** Secções do pacote de revenda */
/** Como a revenda funciona no servidor (o Hestia não tem revendedores) */
export function ComoFuncionaRevenda() {
  const { t } = useVH();
  return (
    <div className="note">
      <b>{t('Como funciona a revenda')}</b>
      <br />
      {t('No servidor, o revendedor é uma conta normal, com o seu próprio domínio. Cada cliente que ele criar recebe a sua própria conta, com o seu domínio, e o VisualHost liga essa conta ao revendedor. O pacote de revenda decide quantas contas de cliente e quanto espaço o revendedor pode distribuir.')}
    </div>
  );
}

export function FormPacoteRevenda({ value, onChange, conta }: { value: PacoteRevenda; onChange: (p: PacoteRevenda) => void; conta?: boolean }) {
  return (
    <>
      {!conta && <ComoFuncionaRevenda />}
      <Frm title="Limites" desc={conta ? 'Mudar os limites desta conta' : 'Total que o revendedor pode distribuir pelos seus clientes'}>
        <Limites campos={LIMITES_REVENDA} lim={value.lim} set={(k, l) => onChange(set(value, 'lim', { ...value.lim, [k]: l }))} />
        <Row label="IPs" hint="Endereços IP próprios do revendedor">
          <input inputMode="numeric" value={value.ips} onChange={(e) => onChange(set(value, 'ips', e.target.value))} style={{ maxWidth: 120 }} />
        </Row>
      </Frm>
      <Frm title="Funcionalidades" desc={conta ? 'Ligar ou desligar funcionalidades desta conta' : 'O que o revendedor pode dar aos seus clientes'}>
        <Funcionalidades campos={FUNC_REVENDA} feats={value.feats} set={(k, v) => onChange(set(value, 'feats', { ...value.feats, [k]: v }))} />
      </Frm>
      <Frm title="Nameservers da marca" desc="Servidores de nomes com o nome do revendedor (ns1/ns2)">
        <Row label="Nameservers próprios" hint="Os clientes do revendedor passam a usar estes nomes">
          <Check checked={!!value.nsProprios} onChange={(v) => onChange(set(value, 'nsProprios', v))} label="Permitir que o revendedor use nameservers com a sua marca (ex.: ns1.marca.co.mz)" />
        </Row>
      </Frm>
      <Frm title="Partilhar IP do servidor">
        <Row label="IP do servidor">
          <Check checked={value.ipServidor} onChange={(v) => onChange(set(value, 'ipServidor', v))} label="Permitir que o revendedor crie sites com o IP do servidor" />
        </Row>
      </Frm>
      <Frm title="Limites de recursos" desc="Valores máximos que o revendedor pode dar aos seus clientes">
        <Limites campos={RECURSOS} lim={value.rec} set={(k, l) => onChange(set(value, 'rec', { ...value.rec, [k]: l }))} />
      </Frm>
    </>
  );
}

// ---------- Lista ----------
type Linha = { nome: string; bw: string; disk: string; dom: string; mails: string; ips: string; usado: number };

function ListaPacotes({ tipo }: { tipo: Tipo }) {
  const vh = useVH();
  const { s, nav, toast, openM, updateDb } = vh;
  const base = '/' + s.level + '/' + s.page;
  const fonte = tipo === 'cliente' ? s.db.pkgs : s.db.rpkgs;
  const usadoPor = (nome: string) => Object.values(s.acc).filter((a) => a.pkg === nome && (tipo === 'revenda' ? a.role === 'revenda' : a.role !== 'revenda' && a.role !== 'admin')).length;
  const rows: Linha[] = Object.entries(fonte).map(([nome, p]) => ({
    nome,
    bw: limTxt(p.lim.bw),
    disk: limTxt(p.lim.disk),
    dom: limTxt(p.lim.domains),
    mails: limTxt(p.lim.emails),
    ips: tipo === 'revenda' ? (p as PacoteRevenda).ips : '',
    usado: usadoPor(nome),
  }));
  // ordem fixa dos pacotes de cliente (Silva, 20/10/2026): primeiro os de e-mail (do Starter ao maior), o Default no meio e
  // depois os VHost (do Básico ao Business); os que não estão na lista ficam no fim, pela ordem em que existem
  if (tipo === 'cliente') {
    const ORDEM = ['starter', 'email-basico', 'email-premium', 'email-business', 'default', 'vhost-basico', 'vhost-pro', 'vhost-premium', 'vhost-business'];
    const pos = (n: string) => {
      const i = ORDEM.indexOf(n.toLowerCase());
      return i < 0 ? ORDEM.length : i;
    };
    rows.sort((x, y) => pos(x.nome) - pos(y.nome));
  }
  const cols: Col<Linha>[] = [
    { k: 'nome', t: 'Pacote', cell: (r) => <a className="lk" style={{ color: 'inherit' }} onClick={() => nav(base + '/' + encodeURIComponent(r.nome))}>{r.nome === 'default' ? 'Default' : r.nome}</a> },
    { k: 'bw', t: 'Tráfego', center: true, cell: (r) => r.bw },
    { k: 'disk', t: 'Espaço em disco', center: true, cell: (r) => r.disk },
    ...(tipo === 'revenda' ? [{ k: 'ips', t: 'IPs', center: true, cell: (r: Linha) => r.ips }] : []),
    { k: 'dom', t: 'Domínios', center: true, cell: (r) => r.dom, hidden: true },
    { k: 'mails', t: 'Contas de e-mail', center: true, cell: (r) => r.mails, hidden: true },
    { k: 'usado', t: tipo === 'revenda' ? 'Revendedores' : 'Contas', center: true, cell: (r) => r.usado },
  ];
  const exportar = (keys: string[]) => {
    const data = Object.fromEntries(keys.map((k) => [k, fonte[k]]));
    const url = URL.createObjectURL(new Blob([JSON.stringify({ tipo, pacotes: data }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = (tipo === 'revenda' ? 'pacotes-revenda' : 'pacotes-cliente') + '-visualhost.json';
    a.click();
    URL.revokeObjectURL(url);
    toast(keys.length + ' pacote(s) exportado(s)');
  };
  const apagar = (keys: string[]) => {
    const emUso = keys.filter((k) => usadoPor(k) > 0);
    if (emUso.length) return toast('Em uso, não pode ser apagado: ' + emUso.join(', '));
    openM(
      <Confirmar
        titulo="Apagar pacotes?"
        texto={'Vai apagar: ' + keys.join(', ') + '.'}
        ok="Apagar"
        onOk={() => {
          // pacotes de cliente: apagam-se no servidor (Hestia)
          if (tipo === 'cliente') void noServidorDetalhe(vh, { acao: 'pacote-apagar', pacotes: keys }, (n) => n + ' pacote(s) apagado(s)');
          else {
            updateDb((db) => keys.forEach((k) => delete db.rpkgs[k]));
            toast(keys.length + ' pacote(s) apagado(s)');
          }
        }}
      />,
    );
  };
  return (
    <DataTable
      id={'pacotes-' + tipo}
      rows={rows}
      cols={cols}
      rowKey={(r) => r.nome}
      search={(r) => r.nome}
      actions={
        s.level === 'admin'
          ? (r) => (
              <span className="dns-acoes">
                <button className="btn sm btn-ed btn-dns-edit" onClick={() => nav(base + '/' + encodeURIComponent(r.nome))}>
                  <i className="fa-solid fa-pen-to-square" />
                  {vh.t('Editar')}
                </button>
              </span>
            )
          : undefined
      }
      bulk={[
        // o administrador edita qualquer pacote (Silva, 16/10/2026); com um só assinalado
        ...(s.level === 'admin'
          ? [{ t: 'Editar pacote', fa: 'fa-pen', run: (k: string[]) => (k.length === 1 ? nav(base + '/' + encodeURIComponent(k[0])) : toast('Assinale só um pacote para editar')) }]
          : []),
        { t: 'Apagar', fa: 'fa-trash', run: apagar },
        { t: 'Exportar', fa: 'fa-file-export', run: exportar },
      ]}
      empty="Ainda não há pacotes"
    />
  );
}

export function Confirmar({ titulo, texto, ok, onOk }: { titulo: string; texto: string; ok: string; onOk: () => void }) {
  const { t, closeM } = useVH();
  return (
    <>
      <h3>{t(titulo)}</h3>
      <p style={{ lineHeight: 1.5 }}>{texto}</p>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={() => {
            closeM();
            onOk();
          }}
        >
          {t(ok)}
        </button>
      </div>
    </>
  );
}

function ImportarPacotes({ tipo }: { tipo: Tipo }) {
  const { t, toast, closeM, updateDb } = useVH();
  const ref = useRef<HTMLInputElement>(null);
  const importar = async () => {
    const f = ref.current?.files?.[0];
    if (!f) return toast('Escolha um ficheiro');
    try {
      const j = JSON.parse(await f.text());
      const pacotes = j.pacotes || {};
      const n = Object.keys(pacotes).length;
      if (!n || (j.tipo && j.tipo !== tipo)) return toast('O ficheiro não tem pacotes deste tipo');
      updateDb((db) => Object.assign(tipo === 'cliente' ? db.pkgs : db.rpkgs, pacotes));
      closeM();
      toast(n + ' pacote(s) importado(s)');
    } catch {
      toast('Ficheiro inválido');
    }
  };
  return (
    <>
      <h3>{t('Importar pacotes')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>Ficheiro exportado do VisualHost (botão Exportar). Os pacotes com o mesmo nome são substituídos.</p>
      <div className="f">
        <input ref={ref} type="file" accept="application/json,.json" style={{ height: 'auto', padding: 8 }} />
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button className="btn r" onClick={importar}>
          {t('Importar')}
        </button>
      </div>
    </>
  );
}

// ---------- Criar / editar ----------
function EditarPacote({ tipo, nome }: { tipo: Tipo; nome: string | null }) {
  const vh = useVH();
  const { s, t, nav, toast, updateDb } = vh;
  const base = '/' + s.level + '/' + s.page;
  const fonte = tipo === 'cliente' ? s.db.pkgs : s.db.rpkgs;
  const [p, setP] = useState<PacoteUtilizador | PacoteRevenda>(() =>
    (() => {
      const base = structuredClone(nome ? fonte[nome] : tipo === 'cliente' ? pacoteVazio() : pacoteRevendaVazio());
      // o que o Hestia não guarda (inodes, funcionalidades do painel, IO…) vem do que ficou guardado neste painel
      const p = tipo === 'cliente' && nome ? comExtras(base as PacoteUtilizador, s.extrasPlano?.[nome]) : base;
      // o tema do plano vem do servidor (Admin › Pacotes › Tema), não do ficheiro do Hestia
      if (tipo === 'cliente') (p as PacoteUtilizador).tema = (nome && s.temasPlano?.[nome]) || 'visualdesign';
      return p;
    })(),
  );
  const [novoNome, setNovoNome] = useState(nome || '');
  const [renomear, setRenomear] = useState(false);
  // Pacotes de cliente: criam-se e gravam-se no servidor (antes: "Ainda não ligado ao servidor")
  const gravarNoServidor = async (n: string) => {
    const pu = p as PacoteUtilizador;
    const { feitas } = await noServidorDetalhe(
      vh,
      { acao: 'pacote-gravar', gravar: { nome: n, ...(nome && n !== nome ? { de: nome } : {}), editar: !!nome, lim: pu.lim, feats: pu.feats, rec: pu.rec, hestia: pu.hestia } },
      () => (nome ? 'Pacote ' + n + ' gravado' : 'Pacote ' + n + ' criado'),
    );
    if (!feitas.length) return;
    await fetch('/api/vhost/acessos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ temas: { [n]: pu.tema }, extras: { [n]: extrasDoPacote(pu) } }) }).catch(() => {});
    nav(base);
  };
  const gravar = () => {
    const n = novoNome.trim();
    if (!n) return toast('Escreva o nome do pacote');
    if (n !== nome && fonte[n]) return toast('Já existe um pacote com esse nome');
    if (tipo === 'cliente') return void gravarNoServidor(n);
    updateDb((db, acc) => {
      const dst = db.rpkgs as Record<string, PacoteUtilizador | PacoteRevenda>;
      if (nome && n !== nome) {
        delete dst[nome];
        for (const a of Object.values(acc)) if (a.pkg === nome) a.pkg = n;
      }
      dst[n] = p;
    });
    toast(nome ? 'Pacote ' + n + ' gravado' : 'Pacote ' + n + ' criado');
    nav(base);
  };
  return (
    <>
      {tipo === 'cliente' ? (
        <FormPacoteUtilizador value={p as PacoteUtilizador} onChange={setP} />
      ) : (
        <FormPacoteRevenda value={p as PacoteRevenda} onChange={setP} />
      )}
      <Frm
        title="Nome do pacote"
        foot={
          <>
            <button className="btn g" onClick={() => nav(base)}>
              {t('Cancelar')}
            </button>
            <button className="btn r" onClick={gravar}>
              <i className="fa-solid fa-floppy-disk" />
              {t(nome ? 'Guardar' : 'Criar')}
            </button>
          </>
        }
      >
        <Row label="Nome do pacote">
          <input value={novoNome} disabled={!!nome && !renomear} onChange={(e) => setNovoNome(e.target.value)} placeholder="ex.: Business" />
          {nome && <Check checked={renomear} onChange={setRenomear} label="Mudar o nome" muted />}
        </Row>
      </Frm>
    </>
  );
}

/** Ecrã de pacotes: lista, /novo ou /<pacote> */
export function pacotes(tipo: Tipo): ScreenFn {
  return (vh: VH) => {
    const { s, t, nav, openM } = vh;
    const base = '/' + s.level + '/' + s.page;
    const listaT = tipo === 'cliente' ? 'Pacotes de cliente' : 'Pacotes de revenda';
    const sub = s.sub[0];
    const fonte = tipo === 'cliente' ? s.db.pkgs : s.db.rpkgs;
    if (sub === 'novo')
      return {
        title: tipo === 'cliente' ? 'Novo pacote de cliente' : 'Novo pacote de revenda',
        desc: 'Limites, funcionalidades e recursos do pacote',
        crumbs: [{ t: listaT, path: base }, { t: 'Novo pacote' }],
        body: <EditarPacote tipo={tipo} nome={null} />,
      };
    if (sub)
      return fonte[sub]
        ? {
            title: sub,
            desc: 'Limites, funcionalidades e recursos do pacote',
            crumbs: [{ t: listaT, path: base }, { t: sub }],
            body: <EditarPacote tipo={tipo} nome={sub} />,
          }
        : { title: 'Pacote não encontrado', crumbs: [{ t: listaT, path: base }, { t: sub }], body: <div className="empty card">{t('Este pacote não existe')}</div> };
    return {
      title: listaT,
      actions: (
        <>
          <button className="btn g sec-m" onClick={() => openM(<ImportarPacotes tipo={tipo} />)}>
            <i className="fa-solid fa-file-import" />
            {t('Importar pacotes')}
          </button>
          <button className="btn r" onClick={() => nav(base + '/novo')}>
            <i className="fa-solid fa-plus" />
            {t(tipo === 'cliente' ? 'Adicionar pacote' : 'Criar pacote')}
          </button>
        </>
      ),
      body: <ListaPacotes tipo={tipo} />,
    };
  };
}
