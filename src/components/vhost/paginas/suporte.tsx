'use client';

// Suporte e ajuda (Ajuda · Suporte · Documentação da API) e as secções da barra de ícones: Perfil, Preferências e
// Mensagens. Pedidos de suporte e mensagens vêm das tabelas do site (tickets_suporte, ticket_respostas,
// notifications) por /api/vhost/suporte e /api/vhost/mensagens; o perfil por /api/vhost/perfil e, para a
// palavra-passe e as sessões, pelo Supabase Auth do navegador (com a sessão da própria pessoa).
import { useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { DESC, MENU } from '../generated/data';
import { ico } from '../state';
import { esquecerMemoria, useGet, useNaMemoria } from '../carga';
import { DataTable, Esqueleto, Senha, Switch, Tabs } from './componentes';
import { Confirmar } from './pacotes';

// ---------- Peças comuns ----------
function Sec({ titulo, desc, children }: { titulo: string; desc?: string; children: ReactNode }) {
  const { t } = useVH();
  return (
    <section className="da-sec">
      <div className="seccao-h">
        <div>
          <h3>{t(titulo)}</h3>
          {desc && <p>{t(desc)}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Carregando({ erro, ler }: { erro: string; ler: () => void }) {
  const { t } = useVH();
  return erro ? (
    <div className="imp">
      <i className="fa-solid fa-triangle-exclamation" />
      <div>{erro}</div>
      <button className="btn g sm" onClick={ler}>
        {t('Tentar de novo')}
      </button>
    </div>
  ) : (
    <Esqueleto /> // a carregar: a página em esqueleto, nunca vazia
  );
}

/** Pedido ao site; mostra o resultado no aviso e devolve a resposta (ou null) */
async function enviar(vh: VH, rota: string, corpo: Record<string, unknown>, ok: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      vh.toast(String(j.erro || 'Não foi possível'));
      return null;
    }
    esquecerMemoria(rota);
    vh.toast(ok);
    return j;
  } catch {
    vh.toast('Sem ligação ao site.');
    return null;
  }
}

const dataPt = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return lerPref('vh-data', 'dmy') === 'ymd'
    ? `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
    : `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Preferências do navegador (Preferências → Idioma, Tabelas, Gestor de ficheiros) */
export function lerPref(k: string, def: string): string {
  try {
    return localStorage.getItem(k) ?? def;
  } catch {
    return def;
  }
}
function gravarPref(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}

// ---------- Ajuda ----------
const PERGUNTAS: [string, string][] = [
  ['Como configuro o e-mail no telemóvel ou no Outlook?', 'Use o endereço completo como utilizador e a palavra-passe da caixa. Correio a chegar (IMAP): mail.<o seu domínio>, porta 993, SSL. Correio a sair (SMTP): mail.<o seu domínio>, porta 465, SSL, com autenticação. Em E-mail → Contas de e-mail, o botão de cada caixa mostra estes dados já preenchidos.'],
  ['Como aponto o meu domínio para este alojamento?', 'No sítio onde comprou o domínio, mude os servidores de nomes (nameservers) para os que aparecem em Gestão de domínios → DNS. A mudança pode demorar até 24 horas a chegar a todo o lado.'],
  ['Como instalo o WordPress?', 'Avançado → WordPress → Locais sem WordPress → Instalar. Escolha o título, o utilizador e a palavra-passe do administrador; fica pronto em cerca de um minuto.'],
  ['Como ponho o site com cadeado (https)?', 'Gestão de domínios → SSL/TLS. O certificado gratuito é pedido e renovado sozinho, desde que o domínio já aponte para este servidor.'],
  ['Como crio uma base de dados?', 'Gestão de domínios → Bases de dados → Criar base de dados. O nome e o utilizador começam sempre pelo nome da sua conta.'],
  ['Como faço uma cópia de segurança?', 'Avançado → Cópias de segurança → Fazer cópia agora. A cópia leva sites, e-mail, bases de dados e tarefas cron; pode descarregá-la ou restaurá-la depois.'],
  ['Esqueci-me da palavra-passe de uma caixa de e-mail.', 'E-mail → Contas de e-mail → escolha a conta → Mudar palavra-passe. A palavra-passe antiga deixa de funcionar logo.'],
  ['Onde vejo quanto espaço estou a usar?', 'No Dashboard (separador Gestão) e em Sistema e ficheiros → Uso de recursos.'],
];

function Ajuda() {
  const vh = useVH();
  const { t, s, nav, go } = vh;
  const [q, setQ] = useState('');
  const qq = q.trim().toLowerCase();
  const grupos = MENU.utilizador
    .filter(([g]) => g !== 'Início')
    .map(([g, itens]) => [g, itens.filter((it) => vh.hasFeat(it.feat)).filter((it) => !qq || (t(it.t) + ' ' + (DESC['utilizador/' + it.id]?.[0] || '')).toLowerCase().includes(qq))] as const)
    .filter(([, itens]) => itens.length);
  const perguntas = PERGUNTAS.filter(([p, r]) => !qq || (p + ' ' + r).toLowerCase().includes(qq));
  return (
    <>
      <div className="aj-busca">
        <i className="fa-solid fa-magnifying-glass" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Procurar na ajuda (ex.: e-mail no telemóvel, WordPress, SSL)…')} aria-label={t('Procurar na ajuda')} />
      </div>
      {!!perguntas.length && (
        <Sec titulo="Perguntas frequentes">
          <div className="aj-faq">
            {perguntas.map(([p, r]) => (
              <details key={p}>
                <summary>{t(p)}</summary>
                <p>{t(r)}</p>
              </details>
            ))}
          </div>
        </Sec>
      )}
      {grupos.map(([g, itens]) => (
        <Sec key={g} titulo={g}>
          <div className="aj-grelha">
            {itens.map((it) => (
              <button key={it.id} className="aj-item" onClick={() => (s.level === 'utilizador' ? go(it.id) : nav('/utilizador/' + it.id))}>
                <span className={'da-card-ic ' + it.c}>
                  <i className={ico(it.fa)} />
                </span>
                <span>
                  <b>{t(it.t)}</b>
                  <small>{DESC['utilizador/' + it.id]?.[s.lang === 'en' ? 1 : 0] || ''}</small>
                </span>
              </button>
            ))}
          </div>
        </Sec>
      ))}
      {!grupos.length && !perguntas.length && <div className="card empty">{t('Nada encontrado. Abra um pedido de suporte e nós ajudamos.')}</div>}
      <div className="aj-rodape">
        {t('Não encontrou o que procura?')}{' '}
        <a className="lk" onClick={() => nav('/utilizador/tickets/novo')}>
          {t('Abrir um pedido de suporte')}
        </a>
      </div>
    </>
  );
}

// ---------- Suporte (pedidos) ----------
type Pedido = { id: string; assunto: string; descricao?: string; categoria: string; prioridade: string; status: string; created_at: string; updated_at: string };
type Resposta = { id: string; resposta: string; respondente: string | null; created_at: string };
const CATS: Record<string, string> = { geral: 'Geral', tecnico: 'Técnico', dominios: 'Domínios', email: 'E-mail', faturacao: 'Faturação' };
const PRIOS: Record<string, [string, string]> = { baixa: ['Baixa', 'off'], normal: ['Normal', 'ok'], alta: ['Alta', 'w'], urgente: ['Urgente', 'bad'] };
const ESTADOS: Record<string, [string, string]> = {
  open: ['Aberto', 'w'],
  in_progress: ['Em tratamento', 'w'],
  answered: ['Respondido', 'ok'],
  waiting_client: ['À espera da sua resposta', 'ok'],
  closed: ['Fechado', 'off'],
};
const estado = (s: string) => ESTADOS[s] || [s || 'Aberto', 'w'];

function Pedidos() {
  const vh = useVH();
  const { t, nav } = vh;
  const { dados, erro, ler } = useGet<{ pedidos: Pedido[] }>('/api/vhost/suporte');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  return (
    <Sec titulo="Pedidos de suporte" desc="Os pedidos que abriu e as respostas da equipa. Respondemos normalmente em até 2 horas, nos dias úteis.">
      <DataTable
        id="tickets"
        rows={dados.pedidos}
        rowKey={(r) => r.id}
        empty="Ainda não abriu nenhum pedido de suporte"
        cols={[
          { k: 'a', t: 'Assunto', sort: (r) => r.assunto, cell: (r) => <a className="lk" onClick={() => nav('/utilizador/tickets/' + r.id)}>{r.assunto}</a> },
          { k: 'c', t: 'Categoria', cell: (r) => t(CATS[r.categoria] || r.categoria) },
          { k: 'p', t: 'Prioridade', cell: (r) => <span className={'tag ' + (PRIOS[r.prioridade]?.[1] || 'ok')}>{t(PRIOS[r.prioridade]?.[0] || r.prioridade)}</span> },
          { k: 's', t: 'Estado', cell: (r) => <span className={'tag ' + estado(r.status)[1]}>{t(estado(r.status)[0])}</span> },
          { k: 'u', t: 'Atualizado', sort: (r) => r.updated_at || r.created_at, cell: (r) => dataPt(r.updated_at || r.created_at) },
        ]}
        actions={(r) => (
          <button className="btn sm g" onClick={() => nav('/utilizador/tickets/' + r.id)}>
            {t('Abrir')}
          </button>
        )}
      />
    </Sec>
  );
}

function NovoPedido() {
  const vh = useVH();
  const { t, nav, a, s } = vh;
  const doms = a.domains.map((x) => x.name);
  const [f, setF] = useState({ assunto: '', categoria: 'tecnico', prioridade: 'normal', dominio: (s.dominio && doms.includes(s.dominio) ? s.dominio : doms[0]) || '', descricao: '' });
  const [a2, setA2] = useState(false);
  return (
    <Sec titulo="Abrir pedido de suporte" desc="Explique o que se passa; quanto mais detalhes (o que fez, o que esperava, a mensagem de erro), mais depressa resolvemos.">
      <div className="frm">
        <div className="row">
          <div className="field" style={{ flex: 2 }}>
            <label>{t('Assunto')}</label>
            <input className="inp" value={f.assunto} maxLength={160} onChange={(e) => setF({ ...f, assunto: e.target.value })} placeholder={t('Ex.: o site mostra erro 500')} />
          </div>
          <div className="field">
            <label>{t('Domínio')}</label>
            <select className="inp" value={f.dominio} onChange={(e) => setF({ ...f, dominio: e.target.value })}>
              <option value="">{t('Nenhum em especial')}</option>
              {doms.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>{t('Categoria')}</label>
            <select className="inp" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
              {Object.entries(CATS).map(([k, v]) => (
                <option key={k} value={k}>
                  {t(v)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t('Prioridade')}</label>
            <select className="inp" value={f.prioridade} onChange={(e) => setF({ ...f, prioridade: e.target.value })}>
              {Object.entries(PRIOS).map(([k, [v]]) => (
                <option key={k} value={k}>
                  {t(v)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>{t('Descrição')}</label>
          <textarea className="inp em-txt" rows={8} value={f.descricao} maxLength={8000} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
        </div>
        <div className="mfoot" style={{ justifyContent: 'flex-start' }}>
          <button
            className="btn r"
            disabled={a2 || f.assunto.trim().length < 3 || f.descricao.trim().length < 10}
            onClick={async () => {
              setA2(true);
              const j = await enviar(vh, '/api/vhost/suporte', { acao: 'criar', ...f }, 'Pedido enviado à equipa de suporte');
              setA2(false);
              if (j?.id) nav('/utilizador/tickets/' + j.id);
            }}
          >
            <i className="fa-solid fa-paper-plane" />
            {t('Enviar pedido')}
          </button>
        </div>
      </div>
    </Sec>
  );
}

function VerPedido({ id }: { id: string }) {
  const vh = useVH();
  const { t, openM } = vh;
  const { dados, erro, ler } = useGet<{ pedido: Pedido; respostas: Resposta[] }>('/api/vhost/suporte?id=' + encodeURIComponent(id));
  const [txt, setTxt] = useState('');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const p = dados.pedido;
  const fechado = p.status === 'closed';
  return (
    <>
      <div className="da-grelha">
        <div className="da-lin n3">
          {(
            [
              ['fa-tag', 'Categoria', t(CATS[p.categoria] || p.categoria)],
              ['fa-signal', 'Prioridade', t(PRIOS[p.prioridade]?.[0] || p.prioridade)],
              ['fa-circle-info', 'Estado', t(estado(p.status)[0])],
            ] as [string, string, string][]
          ).map(([fa, l, v]) => (
            <div className="da-cel" key={l}>
              <i className={'fa-solid ' + fa} />
              <div>
                <small>{t(l)}</small>
                <span>{v}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="tk-fio">
        <div className="tk-msg cliente">
          <div className="tk-cab">
            <b>{t('Você')}</b> · {dataPt(p.created_at)}
          </div>
          <div className="tk-txt">{p.descricao}</div>
        </div>
        {dados.respostas.map((r) => (
          <div key={r.id} className={'tk-msg ' + (r.respondente === 'cliente' ? 'cliente' : 'equipa')}>
            <div className="tk-cab">
              <b>{r.respondente === 'cliente' ? t('Você') : t('Equipa de suporte')}</b> · {dataPt(r.created_at)}
            </div>
            <div className="tk-txt">{r.resposta}</div>
          </div>
        ))}
      </div>
      {fechado ? (
        <div className="note">{t('Este pedido está fechado. Se precisar de mais ajuda, abra um pedido novo.')}</div>
      ) : (
        <div className="frm">
          <div className="field">
            <label>{t('Responder')}</label>
            <textarea className="inp em-txt" rows={5} value={txt} maxLength={8000} onChange={(e) => setTxt(e.target.value)} />
          </div>
          <div className="mfoot" style={{ justifyContent: 'flex-start' }}>
            <button
              className="btn r"
              disabled={txt.trim().length < 2}
              onClick={async () => {
                if (await enviar(vh, '/api/vhost/suporte', { acao: 'responder', id, texto: txt }, 'Resposta enviada')) {
                  setTxt('');
                  ler();
                }
              }}
            >
              <i className="fa-solid fa-reply" />
              {t('Enviar resposta')}
            </button>
            <button className="btn g" onClick={() => openM(<Confirmar titulo="Fechar o pedido?" texto="Feche-o quando o problema estiver resolvido." ok="Fechar pedido" onOk={async () => (await enviar(vh, '/api/vhost/suporte', { acao: 'fechar', id }, 'Pedido fechado')) && ler()} />)}>
              {t('Fechar pedido')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Documentação da API ----------
function Api() {
  const vh = useVH();
  const { t, s, me, nav } = vh;
  const host = s.srv?.hostname || 'servidor';
  const base = `https://${host}:8083/api/`;
  const curl = `curl -s -X POST ${base} \\\n  -d 'hash=CHAVE_DE_ACESSO:CHAVE_SECRETA' \\\n  -d 'returncode=no' \\\n  -d 'cmd=v-list-web-domains' \\\n  -d 'arg1=${me}' \\\n  -d 'arg2=json'`;
  const php = `<?php\n$r = curl_init('${base}');\ncurl_setopt_array($r, [\n  CURLOPT_POST => true,\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_POSTFIELDS => http_build_query([\n    'hash' => 'CHAVE_DE_ACESSO:CHAVE_SECRETA',\n    'returncode' => 'no',\n    'cmd' => 'v-list-mail-accounts',\n    'arg1' => '${me}',\n    'arg2' => 'o-seu-dominio.co.mz',\n    'arg3' => 'json',\n  ]),\n]);\n$dados = json_decode(curl_exec($r), true);`;
  const CMDS: [string, string][] = [
    ['v-list-web-domains', 'Sites da conta (arg1 = conta, arg2 = json)'],
    ['v-list-mail-domains', 'Domínios de e-mail'],
    ['v-list-mail-accounts', 'Caixas de e-mail de um domínio (arg2 = domínio)'],
    ['v-add-mail-account', 'Criar caixa (arg2 = domínio, arg3 = nome, arg4 = palavra-passe)'],
    ['v-list-databases', 'Bases de dados'],
    ['v-list-dns-records', 'Registos DNS de uma zona (arg2 = domínio)'],
    ['v-list-user-backups', 'Cópias de segurança'],
  ];
  return (
    <>
      <Sec titulo="Como funciona" desc="Os seus programas podem gerir a conta por pedidos HTTPS, sem a sua palavra-passe, com uma chave de acesso.">
        <ol className="api-passos">
          <li>
            {t('Crie uma chave em')}{' '}
            <a className="lk" onClick={() => nav('/utilizador/chaves-login')}>
              {t('Avançado → Chaves de login')}
            </a>{' '}
            {t('e escolha só as funções de que o programa precisa.')}
          </li>
          <li>{t('Envie os pedidos por POST para o endereço abaixo, com a chave no campo hash (chave de acesso : chave secreta).')}</li>
          <li>{t('Com returncode=no a resposta vem em texto ou JSON; com returncode=yes vem só o código (0 = correu bem).')}</li>
        </ol>
        <div className="api-ender">
          <small>{t('Endereço')}</small>
          <code>{base}</code>
        </div>
      </Sec>
      <Sec titulo="Exemplos">
        <div className="api-ex">
          <small>cURL</small>
          <pre>{curl}</pre>
          <small>PHP</small>
          <pre>{php}</pre>
        </div>
      </Sec>
      <Sec titulo="Comandos mais usados" desc="Cada chave só pode usar os comandos que lhe deu ao criá-la.">
        <div className="tbl">
          <table>
            <thead>
              <tr>
                <th>{t('Comando')}</th>
                <th>{t('O que faz')}</th>
              </tr>
            </thead>
            <tbody>
              {CMDS.map(([c, d]) => (
                <tr key={c}>
                  <td>
                    <code>{c}</code>
                  </td>
                  <td>{t(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sec>
    </>
  );
}

// ---------- Perfil ----------
type DadosPerfil = { perfil: Record<string, string | null>; email: string; criada: string | null; ultimaEntrada: string | null; avisos: { limite: boolean; seguranca: boolean } };

function PerfilGeral() {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useGet<DadosPerfil>('/api/vhost/perfil');
  const [f, setF] = useState<Record<string, string> | null>(null);
  const [novoEmail, setNovoEmail] = useState('');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const v = f || Object.fromEntries(['name', 'telefone', 'empresa', 'morada', 'cidade', 'site', 'nuit'].map((k) => [k, String(dados.perfil[k] || '')]));
  const campo = (k: string, l: string, ph = '') => (
    <div className="field">
      <label>{t(l)}</label>
      <input className="inp" value={v[k]} placeholder={ph} onChange={(e) => setF({ ...v, [k]: e.target.value })} />
    </div>
  );
  return (
    <>
      <Sec titulo="Dados pessoais" desc="O nome e os contactos que a equipa usa para falar consigo e nas faturas.">
        <div className="frm">
          <div className="row">
            {campo('name', 'Nome')}
            {campo('telefone', 'Telefone', '+258 …')}
          </div>
          <div className="row">
            {campo('empresa', 'Empresa')}
            {campo('nuit', 'NUIT')}
          </div>
          <div className="row">
            {campo('morada', 'Morada')}
            {campo('cidade', 'Cidade')}
          </div>
          {campo('site', 'Site', 'https://…')}
          <div className="mfoot" style={{ justifyContent: 'flex-start' }}>
            <button className="btn r" disabled={!f} onClick={async () => (await enviar(vh, '/api/vhost/perfil', { acao: 'dados', ...v }, 'Dados guardados')) && (setF(null), ler())}>
              {t('Guardar')}
            </button>
          </div>
        </div>
      </Sec>
      <Sec titulo="E-mail de entrada" desc="O endereço com que entra no painel. Ao mudar, chega uma mensagem ao endereço novo para confirmar.">
        <div className="frm">
          <div className="row">
            <div className="field">
              <label>{t('Atual')}</label>
              <input className="inp" value={dados.email} readOnly />
            </div>
            <div className="field">
              <label>{t('Novo endereço')}</label>
              <input className="inp" type="email" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} />
            </div>
          </div>
          <div className="mfoot" style={{ justifyContent: 'flex-start' }}>
            <button
              className="btn g"
              disabled={!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(novoEmail)}
              onClick={async () => {
                const { error } = await supabase.auth.updateUser({ email: novoEmail.trim() });
                vh.toast(error ? error.message : 'Enviámos a confirmação para ' + novoEmail.trim());
                if (!error) setNovoEmail('');
              }}
            >
              {t('Mudar e-mail')}
            </button>
          </div>
        </div>
      </Sec>
    </>
  );
}

function PerfilSenha() {
  const vh = useVH();
  const { t } = vh;
  const [f, setF] = useState({ atual: '', nova: '', repetir: '' });
  const regras: [string, boolean][] = [
    ['Pelo menos 8 caracteres', f.nova.length >= 8],
    ['Letras maiúsculas e minúsculas', /[a-z]/.test(f.nova) && /[A-Z]/.test(f.nova)],
    ['Pelo menos um número', /\d/.test(f.nova)],
    ['As duas novas são iguais', !!f.nova && f.nova === f.repetir],
  ];
  return (
    <Sec titulo="Mudar a palavra-passe" desc="A palavra-passe com que entra no painel. As caixas de e-mail têm cada uma a sua (E-mail → Contas de e-mail).">
      <div className="frm" style={{ maxWidth: 520 }}>
        <div className="field">
          <label>{t('Palavra-passe atual')}</label>
          <input className="inp" type="password" autoComplete="current-password" value={f.atual} onChange={(e) => setF({ ...f, atual: e.target.value })} />
        </div>
        <div className="field">
          <label>{t('Nova palavra-passe')}</label>
          <Senha value={f.nova} onChange={(nova) => setF({ ...f, nova })} />
        </div>
        <div className="field">
          <label>{t('Repetir a nova')}</label>
          <input className="inp" type="password" autoComplete="new-password" value={f.repetir} onChange={(e) => setF({ ...f, repetir: e.target.value })} />
        </div>
        <ul className="pf-regras">
          {regras.map(([l, ok]) => (
            <li key={l} className={ok ? 'ok' : ''}>
              <i className={'fa-solid ' + (ok ? 'fa-circle-check' : 'fa-circle')} /> {t(l)}
            </li>
          ))}
        </ul>
        <div className="mfoot" style={{ justifyContent: 'flex-start' }}>
          <button
            className="btn r"
            disabled={!f.atual || regras.some(([, ok]) => !ok)}
            onClick={async () => {
              const { data } = await supabase.auth.getUser();
              const email = data.user?.email || '';
              const prova = await supabase.auth.signInWithPassword({ email, password: f.atual });
              if (prova.error) return vh.toast('A palavra-passe atual não está certa.');
              const { error } = await supabase.auth.updateUser({ password: f.nova });
              vh.toast(error ? error.message : 'Palavra-passe mudada');
              if (!error) setF({ atual: '', nova: '', repetir: '' });
            }}
          >
            {t('Mudar palavra-passe')}
          </button>
        </div>
      </div>
    </Sec>
  );
}

function PerfilSessoes() {
  const vh = useVH();
  const { t, openM } = vh;
  const { dados, erro, ler } = useGet<DadosPerfil>('/api/vhost/perfil');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : t('Navegador');
  const so = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
  return (
    <>
      <Sec titulo="Sessão atual">
        <div className="da-grelha">
          <div className="da-lin n3">
            {(
              [
                ['fa-display', 'Este aparelho', nav + (so ? ' · ' + so : '')],
                ['fa-right-to-bracket', 'Última entrada', dataPt(dados.ultimaEntrada)],
                ['fa-calendar', 'Conta criada', dataPt(dados.criada)],
              ] as [string, string, string][]
            ).map(([fa, l, v]) => (
              <div className="da-cel" key={l}>
                <i className={'fa-solid ' + fa} />
                <div>
                  <small>{t(l)}</small>
                  <span>{v}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Sec>
      <Sec titulo="Outras sessões" desc="Se entrou noutro computador ou telemóvel e não terminou a sessão, pode terminá-las todas daqui. Esta fica aberta.">
        <button
          className="btn r"
          onClick={() =>
            openM(
              <Confirmar
                titulo="Terminar as outras sessões?"
                texto="Os outros aparelhos vão ter de entrar de novo."
                ok="Terminar"
                onOk={async () => {
                  const { error } = await supabase.auth.signOut({ scope: 'others' });
                  vh.toast(error ? error.message : 'As outras sessões foram terminadas');
                }}
              />,
            )
          }
        >
          <i className="fa-solid fa-right-from-bracket" />
          {t('Terminar as outras sessões')}
        </button>
      </Sec>
    </>
  );
}

function PerfilDoisPassos() {
  const { t } = useVH();
  return (
    <Sec titulo="Autenticação em 2 passos" desc="Um código do telemóvel, além da palavra-passe, para entrar no painel.">
      <div className="note">
        <i className="fa-solid fa-circle-info" style={{ color: 'var(--red)' }} />{' '}
        {t('Ainda não está disponível. Vai funcionar com uma aplicação de autenticação (Google Authenticator, Microsoft Authenticator…) e códigos de recuperação; avisamos quando puder ligá-la.')}
      </div>
    </Sec>
  );
}

function PerfilAvisos() {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useGet<DadosPerfil>('/api/vhost/perfil');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const mudar = async (k: 'limite' | 'seguranca', v: boolean) => (await enviar(vh, '/api/vhost/perfil', { acao: 'avisos', ...dados.avisos, [k]: v }, 'Guardado')) && ler();
  return (
    <Sec titulo="Notificações" desc="Avisos por e-mail e nas Mensagens do painel.">
      <div className="em-opcoes">
        <div>
          <span>
            {t('Avisar quando a conta se aproxima do limite')}
            <small>{t('Espaço em disco, tráfego e caixas de e-mail acima de 80 %.')}</small>
          </span>
          <Switch checked={dados.avisos.limite} onChange={(v) => mudar('limite', v)} label={t('Avisos de limite')} />
        </div>
        <div>
          <span>
            {t('Avisos de segurança')}
            <small>{t('Entradas a partir de aparelhos novos e mudanças de palavra-passe.')}</small>
          </span>
          <Switch checked={dados.avisos.seguranca} onChange={(v) => mudar('seguranca', v)} label={t('Avisos de segurança')} />
        </div>
      </div>
    </Sec>
  );
}

// ---------- Preferências ----------
function Opcao({ titulo, sub, children }: { titulo: string; sub?: string; children: ReactNode }) {
  const { t } = useVH();
  return (
    <div>
      <span>
        {t(titulo)}
        {sub && <small>{t(sub)}</small>}
      </span>
      {children}
    </div>
  );
}

function PrefIdioma() {
  const vh = useVH();
  const { t, s } = vh;
  const [data, setData] = useState(() => lerPref('vh-data', 'dmy'));
  return (
    <Sec titulo="Idioma e data">
      <div className="em-opcoes">
        <Opcao titulo="Idioma do painel">
          <select className="em-sel" value={s.lang} onChange={(e) => vh.setLang(e.target.value as 'pt' | 'en')}>
            <option value="pt">Português</option>
            <option value="en">English</option>
          </select>
        </Opcao>
        <Opcao titulo="Formato da data" sub="Nas listas de mensagens, pedidos e ficheiros.">
          <select
            className="em-sel"
            value={data}
            onChange={(e) => {
              setData(e.target.value);
              gravarPref('vh-data', e.target.value);
              vh.toast('Guardado');
            }}
          >
            <option value="dmy">{t('31/12/2026, 14:30')}</option>
            <option value="ymd">{t('2026-12-31 14:30')}</option>
          </select>
        </Opcao>
      </div>
    </Sec>
  );
}

function PrefTabelas() {
  const vh = useVH();
  const [linhas, setLinhas] = useState(() => lerPref('vh-linhas', '20'));
  const [cols, setCols] = useState(() => lerPref('vh-colunas', '0') === '1');
  return (
    <Sec titulo="Tabelas" desc="Valem para todas as listas do painel, neste navegador.">
      <div className="em-opcoes">
        <Opcao titulo="Linhas por página">
          <select
            className="em-sel"
            value={linhas}
            onChange={(e) => {
              setLinhas(e.target.value);
              gravarPref('vh-linhas', e.target.value);
              vh.toast('Guardado');
            }}
          >
            {['10', '20', '50', '100'].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </Opcao>
        <Opcao titulo="Escolher as colunas visíveis" sub="Mostra o botão Colunas por cima das tabelas.">
          <Switch
            checked={cols}
            onChange={(v) => {
              setCols(v);
              gravarPref('vh-colunas', v ? '1' : '0');
              vh.toast('Guardado');
            }}
            label="Colunas"
          />
        </Opcao>
      </div>
    </Sec>
  );
}

function PrefFicheiros() {
  const vh = useVH();
  const [ocultos, setOcultos] = useState(() => lerPref('vh-fm-ocultos', '1') === '1');
  const [letra, setLetra] = useState(() => lerPref('vh-fm-letra', '13'));
  return (
    <Sec titulo="Gestor de ficheiros">
      <div className="em-opcoes">
        <Opcao titulo="Mostrar ficheiros ocultos" sub="Os que começam por ponto (.htaccess, .env…).">
          <Switch
            checked={ocultos}
            onChange={(v) => {
              setOcultos(v);
              gravarPref('vh-fm-ocultos', v ? '1' : '0');
              vh.toast('Guardado');
            }}
            label="Ocultos"
          />
        </Opcao>
        <Opcao titulo="Tamanho da letra do editor">
          <select
            className="em-sel"
            value={letra}
            onChange={(e) => {
              setLetra(e.target.value);
              gravarPref('vh-fm-letra', e.target.value);
              vh.toast('Guardado');
            }}
          >
            {['12', '13', '14', '15', '16', '18'].map((n) => (
              <option key={n} value={n}>
                {n} px
              </option>
            ))}
          </select>
        </Opcao>
      </div>
    </Sec>
  );
}

// ---------- Mensagens ----------
// Como a página "Messages" do DirectAdmin (pedido do Silva, 13/10/2026; o mesmo que o painel antigo já tinha): uma
// linha por mensagem (ícone, ponto de não lida, assunto, data), cor suave pelo tipo; clicar abre um popup com a
// mensagem completa — e marca-a como lida.
type Mensagem = { id: string; type: string; title: string; message: string; domain: string | null; read: boolean; category: string; link: string | null; link_text: string | null; created_at: string };
const ICONE_MSG: Record<string, [string, string]> = { success: ['fa-circle-check', 'ok'], warning: ['fa-triangle-exclamation', 'w'], error: ['fa-circle-xmark', 'bad'], info: ['fa-circle-info', 'info'] };
const iconeMsg = (tipo: string) => ICONE_MSG[tipo] || ['fa-envelope', ''];

function VerMensagem({ m, onApagar }: { m: Mensagem; onApagar: () => void }) {
  const { t, closeM } = useVH();
  const [icone, cor] = iconeMsg(m.type);
  return (
    <div className="msg-ver">
      <div className="msg-ver-topo">
        <i className={'fa-solid ' + icone + ' ' + cor} />
        <div>
          <h3>{m.title}</h3>
          <small>
            {dataPt(m.created_at)}
            {m.domain ? ' · ' + m.domain : ''}
          </small>
        </div>
      </div>
      <p className="msg-ver-texto">{m.message}</p>
      <div className="mfoot">
        <button
          className="btn g"
          onClick={() => {
            closeM();
            onApagar();
          }}
        >
          <i className="fa-solid fa-trash" />
          {t('Eliminar')}
        </button>
        {m.link && (
          <a className="btn g" href={m.link} target={/^https?:/.test(m.link) ? '_blank' : undefined} rel="noreferrer" onClick={closeM}>
            {m.link_text || t('Abrir')}
          </a>
        )}
        <button className="btn r" onClick={closeM}>
          {t('Fechar')}
        </button>
      </div>
    </div>
  );
}

const ROTULO_MSG = { todas: 'Todas as mensagens', 'nao-lidas': 'Não lidas', avisos: 'Avisos do sistema' } as const;

/** Descrição da barra de cima nas Mensagens (pedido do Silva): "Todas as mensagens | 3 por ler", em letra de descrição.
 *  Usa a leitura que a própria página faz (não pede nada ao servidor). */
function ResumoMensagens({ filtro }: { filtro: keyof typeof ROTULO_MSG }) {
  const { t } = useVH();
  const dados = useNaMemoria<{ naoLidas: number }>('/api/vhost/mensagens?filtro=' + filtro);
  return (
    <>
      {t(ROTULO_MSG[filtro])}
      {dados && (
        <>
          <span className="pdesc-sep">|</span>
          {dados.naoLidas ? dados.naoLidas + ' ' + t('por ler') : t('todas lidas')}
        </>
      )}
    </>
  );
}

function Mensagens({ filtro }: { filtro: 'todas' | 'nao-lidas' | 'avisos' }) {
  const vh = useVH();
  const { t } = vh;
  const rota = '/api/vhost/mensagens?filtro=' + filtro;
  const { dados, erro, ler } = useGet<{ mensagens: Mensagem[]; naoLidas: number }>(rota);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const marcar = async (ids?: string[]) => (await enviar(vh, '/api/vhost/mensagens', { acao: 'lidas', ids }, 'Marcadas como lidas')) && (esquecerMemoria('/api/vhost/mensagens'), ler());
  const apagar = async (ids: string[]) => (await enviar(vh, '/api/vhost/mensagens', { acao: 'apagar', ids }, 'Apagadas')) && (esquecerMemoria('/api/vhost/mensagens'), ler());
  // abrir não mostra aviso: só marca como lida em silêncio
  const abrir = (m: Mensagem) => {
    vh.openM(<VerMensagem m={m} onApagar={() => apagar([m.id])} />);
    if (!m.read)
      void fetch('/api/vhost/mensagens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'lidas', ids: [m.id] }) })
        .then((r) => {
          if (r.ok) {
            esquecerMemoria('/api/vhost/mensagens');
            void ler();
          }
        })
        .catch(() => {});
  };
  const vazio = filtro === 'nao-lidas' ? 'Não há mensagens por ler' : filtro === 'avisos' ? 'Não há avisos do sistema' : 'Não há mensagens';
  return (
    // modelo de Domínios: os separadores abrem o cartão, a pesquisa e os botões ficam por cima do cartão; sem título por
    // cima da tabela — o resumo fica na descrição da barra de cima (ResumoMensagens)
    <>
      <Tabs
        tabs={[
          ['todas', 'Todas as mensagens', 'fa-inbox'],
          ['nao-lidas', 'Não lidas', 'fa-envelope'],
          ['avisos', 'Avisos do sistema', 'fa-triangle-exclamation'],
        ]}
        on={filtro}
        onChange={(k) => vh.nav('/mensagens-sistema/' + k)}
      />
      <DataTable
        id={'msg-' + filtro}
        rows={dados.mensagens}
        rowKey={(r) => r.id}
        empty={vazio}
        search={(r) => r.title + ' ' + r.message + ' ' + (r.domain || '')}
        umaLinha
        barraFora
        rowClass={(r) => 'msg-tipo-' + (ICONE_MSG[r.type] ? r.type : 'info') + (r.read ? '' : ' msg-por-ler')}
        cols={[
          {
            k: 'm',
            t: 'Assunto',
            sort: (r) => r.title,
            cell: (r) => {
              const [icone, cor] = iconeMsg(r.type);
              return (
                <button type="button" className={'msg-linha' + (r.read ? '' : ' nova')} onClick={() => abrir(r)} title={t('Abrir a mensagem')}>
                  <i className={'fa-solid ' + icone + ' ' + cor} />
                  {!r.read && <span className="msg-ponto" title={t('Não lida')} />}
                  <b>{r.title}</b>
                  {r.domain && <small>{r.domain}</small>}
                </button>
              );
            },
          },
          { k: 'd', t: 'Data', sort: (r) => r.created_at, cell: (r) => <span className="msg-data">{dataPt(r.created_at)}</span> },
        ]}
        bulk={[
          { t: 'Marcar todas como lidas', fa: 'fa-check-double', sempre: true, inativo: !dados.naoLidas, run: () => marcar() },
          { t: 'Marcar como lidas', fa: 'fa-check', run: (k) => marcar(k) },
          { t: 'Apagar', fa: 'fa-trash', run: (k) => vh.openM(<Confirmar titulo="Apagar as mensagens?" texto={k.length + ' ' + t('mensagem(ns) escolhida(s).')} ok="Apagar" onOk={() => apagar(k)} />) },
        ]}
      />
    </>
  );
}

// ---------- Rotas ----------
export const ajudaPagina: ScreenFn = () => ({ title: 'Ajuda', body: <Ajuda /> });
export const ticketsPagina: ScreenFn = (vh) => {
  const [a] = vh.s.sub;
  const base = { t: 'Suporte', path: '/utilizador/tickets' };
  const novo = (
    <button className="btn r" onClick={() => vh.nav('/utilizador/tickets/novo')}>
      <i className="fa-solid fa-plus" />
      {vh.t('Abrir pedido')}
    </button>
  );
  if (a === 'novo') return { title: 'Abrir pedido de suporte', crumbs: [base, { t: 'Novo pedido' }], body: <NovoPedido /> };
  if (a) return { title: 'Pedido de suporte', crumbs: [base, { t: 'Pedido' }], body: <VerPedido key={a} id={a} /> };
  return { title: 'Suporte', actions: novo, body: <Pedidos /> };
};
export const apiPagina: ScreenFn = () => ({ title: 'Documentação da API', body: <Api /> });
export const perfilGeral: ScreenFn = () => ({ title: 'Dados pessoais', body: <PerfilGeral /> });
export const perfilSenha: ScreenFn = () => ({ title: 'Palavra-passe', body: <PerfilSenha /> });
export const perfilSessoes: ScreenFn = () => ({ title: 'Sessões', body: <PerfilSessoes /> });
export const perfilDoisPassos: ScreenFn = () => ({ title: 'Autenticação em 2 passos', body: <PerfilDoisPassos /> });
export const perfilAvisos: ScreenFn = () => ({ title: 'Notificações', body: <PerfilAvisos /> });
export const prefIdioma: ScreenFn = () => ({ title: 'Idioma e data', body: <PrefIdioma /> });
export const prefTabelas: ScreenFn = () => ({ title: 'Tabelas', body: <PrefTabelas /> });
export const prefFicheiros: ScreenFn = () => ({ title: 'Gestor de ficheiros', body: <PrefFicheiros /> });
export const msgTodas: ScreenFn = () => ({ title: 'Mensagens', desc: ROTULO_MSG['todas'], descEl: <ResumoMensagens filtro="todas" />, body: <Mensagens key="todas" filtro="todas" /> });
export const msgNaoLidas: ScreenFn = () => ({ title: 'Mensagens', desc: ROTULO_MSG['nao-lidas'], descEl: <ResumoMensagens filtro="nao-lidas" />, body: <Mensagens key="nao-lidas" filtro="nao-lidas" /> });
export const msgAvisos: ScreenFn = () => ({ title: 'Mensagens', desc: ROTULO_MSG['avisos'], descEl: <ResumoMensagens filtro="avisos" />, body: <Mensagens key="avisos" filtro="avisos" /> });
