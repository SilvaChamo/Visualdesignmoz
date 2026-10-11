'use client';

// Janelas (na maquete: openM(...) com o HTML de cada formulário).
import { useState, type ReactNode } from 'react';
import { useVH, type VH } from './context';
import { noServidor } from './paginas/acoes';
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





// Atribuir função (só no nível Admin): muda o tipo da conta e, com ele, os níveis a que tem acesso
export function ChangeRoleModal({ u }: { u: string }) {
  const vh = useVH();
  const { s, t, closeM } = vh;
  const a = s.acc[u];
  const [r, setR] = useState<Role>(a.role);
  // o tipo é o papel do utilizador do site ligado à conta (gravado no registo do site)
  const save = () => {
    closeM();
    noServidor(vh, { acao: 'tipo', contas: [u], tipo: r }, () => u + ' passou a ' + ROLES[r]);
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
