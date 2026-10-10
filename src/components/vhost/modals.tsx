'use client';

// Janelas (na maquete: openM(...) com o HTML de cada formulário).
import { useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useVH, type VH } from './context';
import { LEVELS, MENU, ROLE_LEVELS, ROLE_PKGS, ROLES } from './generated/data';
import { ico } from './state';
import type { Role } from './types';

function Foot({ children }: { children: ReactNode }) {
  return <div className="mfoot">{children}</div>;
}

function CancelBtn() {
  const { t, closeM } = useVH();
  return (
    <button className="btn g" onClick={closeM}>
      {t('Cancelar')}
    </button>
  );
}

export function NewDomainModal() {
  const { a, t, toast, closeM, updateAcc, me } = useVH();
  const [name, setName] = useState('');
  const [php, setPhp] = useState('8.3');
  const add = () => {
    const n = name.trim().toLowerCase();
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(n)) return toast('Escreva um domínio válido');
    if (a.domains.some((d) => d.name === n)) return toast('Esse domínio já existe');
    updateAcc((acc) => {
      acc[me].domains.push({ name: n, ssl: 'ok', php, disk: '0 MB', status: 'ok' });
    });
    closeM();
    toast('Domínio ' + n + ' criado');
  };
  return (
    <>
      <h3>{t('Adicionar domínio')}</h3>
      <div className="f">
        <label>{t('Domínio')}</label>
        <input placeholder="ex.: minhaempresa.co.mz" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="f">
        <label>Versão PHP</label>
        <select value={php} onChange={(e) => setPhp(e.target.value)}>
          <option>8.3</option>
          <option>8.2</option>
          <option>8.1</option>
        </select>
      </div>
      <div className="f">
        <label>
          <input type="checkbox" defaultChecked style={{ width: 'auto', height: 'auto' }} /> Ativar SSL automático
        </label>
      </div>
      <Foot>
        <CancelBtn />
        <button className="btn r" onClick={add}>
          Criar domínio
        </button>
      </Foot>
    </>
  );
}

export function newMail(vh: VH) {
  if (!vh.a.domains.length) return vh.toast('Adicione primeiro um domínio');
  vh.openM(<NewMailModal />);
}

function NewMailModal() {
  const { s, a, t, toast, closeM, updateAcc, me, nav } = useVH();
  const [user, setUser] = useState('');
  const [dom, setDom] = useState(a.domains[0]?.name || '');
  const [pass, setPass] = useState(() => Math.random().toString(36).slice(2, 8) + 'A!' + Math.floor(Math.random() * 90 + 10));
  const [quota, setQuota] = useState('1000');
  const add = () => {
    const u = user.trim().toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(u)) return toast('Escreva um nome válido');
    updateAcc((acc) => {
      acc[me].mails.push({ user: u, dom, used: 0, quota: +quota || 1000, sent: 0 });
    });
    closeM();
    toast('Conta ' + u + '@' + dom + ' criada');
    if (!(s.level === 'utilizador' && s.page === 'email')) nav('/utilizador/email');
  };
  return (
    <>
      <h3>Criar conta de e-mail</h3>
      <div className="f">
        <label>Endereço</label>
        <div className="join">
          <input placeholder="nome" value={user} onChange={(e) => setUser(e.target.value)} />
          <span>
            @
            <select value={dom} onChange={(e) => setDom(e.target.value)} style={{ border: 0, background: 'transparent', height: 'auto', width: 'auto', padding: 0 }}>
              {a.domains.map((d) => (
                <option key={d.name}>{d.name}</option>
              ))}
            </select>
          </span>
        </div>
      </div>
      <div className="f">
        <label>{t('Palavra-passe')}</label>
        <input type="text" value={pass} onChange={(e) => setPass(e.target.value)} />
      </div>
      <div className="f">
        <label>Quota (MB)</label>
        <input type="number" value={quota} onChange={(e) => setQuota(e.target.value)} />
      </div>
      <Foot>
        <CancelBtn />
        <button className="btn r" onClick={add}>
          {t('Criar conta')}
        </button>
      </Foot>
    </>
  );
}

export function DelMailModal({ i }: { i: number }) {
  const { a, toast, closeM, updateAcc, me } = useVH();
  const m = a.mails[i];
  if (!m) return null;
  const del = () => {
    updateAcc((acc) => {
      acc[me].mails.splice(i, 1);
    });
    closeM();
    toast('Conta apagada');
  };
  return (
    <>
      <h3>Apagar conta?</h3>
      <p>
        A conta{' '}
        <b>
          {m.user}@{m.dom}
        </b>{' '}
        e todas as mensagens serão apagadas.
      </p>
      <Foot>
        <CancelBtn />
        <button className="btn r" onClick={del}>
          Apagar
        </button>
      </Foot>
    </>
  );
}

// Atribuir função (só no nível Admin): muda o tipo da conta e, com ele, os níveis a que tem acesso
export function ChangeRoleModal({ u }: { u: string }) {
  const { s, t, toast, closeM, updateAcc } = useVH();
  const a = s.acc[u];
  const [r, setR] = useState<Role>(a.role);
  const save = () => {
    updateAcc((acc) => {
      acc[u].role = r;
      if (!ROLE_PKGS[r].includes(acc[u].pkg)) acc[u].pkg = ROLE_PKGS[r][0];
    });
    closeM();
    toast(u + ' passou a ' + ROLES[r]);
  };
  return (
    <>
      <h3>{t('Mudar tipo de conta')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
        Conta <b style={{ color: 'var(--ink)' }}>{u}</b> · atualmente <b style={{ color: 'var(--ink)' }}>{ROLES[a.role]}</b>. O tipo decide os painéis a que a conta tem acesso.
      </p>
      <div className="f">
        <label>{t('Novo tipo')}</label>
        <select value={r} onChange={(e) => setR(e.target.value as Role)}>
          {(Object.keys(ROLES) as Role[]).map((k) => (
            <option key={k} value={k}>
              {ROLES[k]} — {ROLE_LEVELS[k].map((l) => LEVELS[l]).join(' + ')}
            </option>
          ))}
        </select>
      </div>
      <Foot>
        <CancelBtn />
        <button className="btn r" onClick={save}>
          {t('Guardar')}
        </button>
      </Foot>
    </>
  );
}

export function LogoutModal() {
  const { t, toast, closeM } = useVH();
  return (
    <>
      <h3>{t('Terminar sessão?')}</h3>
      <p>Vai sair do painel VisualHost.</p>
      <Foot>
        <CancelBtn />
        <button
          className="btn r"
          onClick={async () => {
            closeM();
            toast('A terminar a sessão…');
            await supabase.auth.signOut().catch(() => null);
            window.location.assign('/login?redirect=/vhost');
          }}
        >
          {t('Sair')}
        </button>
      </Foot>
    </>
  );
}

/** "Mais" na barra de baixo do telemóvel: idioma, painel e todas as páginas */
export function MoreMenuModal() {
  const { s, t, allowed, hasFeat, closeM, setLang, setLevel, go } = useVH();
  const row = { display: 'flex', gap: 6, marginBottom: 8 } as const;
  return (
    <>
      <h3>{t('Menu')}</h3>
      <div style={row}>
        {(
          [
            ['pt', 'Português'],
            ['en', 'English'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            className={'btn ' + (s.lang === k ? 'r' : 'g') + ' sm'}
            onClick={() => {
              closeM();
              setLang(k);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {allowed.length > 1 && (
        <div style={row}>
          {allowed.map((k) => (
            <button
              key={k}
              className={'btn ' + (s.level === k ? 'r' : 'g') + ' sm'}
              onClick={() => {
                closeM();
                setLevel(k);
              }}
            >
              {t(LEVELS[k])}
            </button>
          ))}
        </div>
      )}
      {MENU[s.level]
        .filter(([g]) => g !== 'Início')
        .map(([g, items]) => {
          const vis = items.filter((it) => hasFeat(it.feat));
          if (!vis.length) return null;
          return (
            <div key={g}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', margin: '10px 0 6px' }}>{t(g)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {vis.map((it) => (
                  <button
                    key={it.id}
                    className="btn g sm"
                    style={{ justifyContent: 'flex-start', overflow: 'hidden' }}
                    onClick={() => {
                      closeM();
                      go(it.id);
                    }}
                  >
                    <i className={ico(it.fa)} />
                    {t(it.t)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      <Foot>
        <button className="btn g" onClick={closeM}>
          {t('Fechar')}
        </button>
      </Foot>
    </>
  );
}
