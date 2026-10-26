'use client';

// Janelas (na maquete: openM(...) com o HTML de cada formulário).
import { useState, type ReactNode } from 'react';
import { useVH, type VH } from './context';
import { noServidor } from './paginas/acoes';
import { LEVELS, MENU, ROLE_LEVELS, ROLE_PKGS, ROLES } from './generated/data';
import { ico, nomeNivel } from './state';
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

/** Menu extra da barra de baixo do telemóvel (Silva, 26/10/2026): Webmail, Mailmarketing e phpMyAdmin, as páginas do grupo «Extras» */
export function MenuExtraModal({ itens }: { itens: { id: string; fa: string; t: string; c?: string }[] }) {
  const { t, closeM, nav } = useVH();
  return (
    <>
      <h3>{t('Menu extra')}</h3>
      <div className="mais-grelha" style={{ margin: '12px 0' }}>
        {itens.map((it) => (
          <button
            key={it.id}
            className="btn g sm mais-item"
            onClick={() => {
              closeM();
              nav('/utilizador/' + it.id);
            }}
          >
            <i className={ico(it.fa) + (it.c ? ' ' + it.c : '')} style={it.c ? { color: 'var(--c)' } : undefined} />
            {t(it.t)}
          </button>
        ))}
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Fechar')}
        </button>
      </div>
    </>
  );
}

/** Menu completo do telemóvel: abre na janela do "Mais" (barra de baixo) e no menu deslizante do ☰ (barra de cima) */
export function MoreMenuModal({ fechar }: { fechar?: () => void } = {}) {
  const { s, t, allowed, hasFeat, closeM, setLevel, go, logout } = useVH();
  const fecha = fechar || closeM;
  return (
    <>
      {/* cabeçalho com fundo suave e uma linha por baixo: Admin | Gestão à esquerda, Sair e Fechar à direita, na mesma linha
          (Silva, 26/10/2026). A língua já não está aqui: escolhe-se na entrada e vale para todo o projecto. */}
      <div className="mais-cab">
        {allowed.length > 1 ? (
          <div className="mais-niveis">
            {allowed.map((k) => (
              <button
                key={k}
                className={'btn ' + (s.level === k ? 'r' : 'g') + ' sm'}
                // não fecha o menu: ao mudar de Admin para Gestão (ou ao contrário) ainda falta escolher a opção onde se quer chegar
                onClick={() => setLevel(k)}
              >
                {t(nomeNivel(k))}
              </button>
            ))}
          </div>
        ) : (
          <h3>{t('Menu')}</h3>
        )}
        <span className="mais-titulo-acoes">
          <button
            type="button"
            className="btn g iconbtn"
            title={t('Sair da conta')}
            aria-label={t('Sair da conta')}
            onClick={() => {
              fecha();
              logout();
            }}
          >
            <i className="fa-solid fa-right-from-bracket" />
          </button>
          <button type="button" className="btn g iconbtn" title={t('Fechar o menu')} aria-label={t('Fechar o menu')} onClick={fecha}>
            <i className="fa-solid fa-xmark" />
          </button>
        </span>
      </div>
      {MENU[s.level]
        .filter(([g]) => g !== 'Início')
        .map(([g, items]) => {
          const vis = items.filter((it) => hasFeat(it.feat, it.id));
          if (!vis.length) return null;
          return (
            <div key={g}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', margin: '10px 0 6px' }}>{t(g)}</div>
              <div className="mais-grelha">
                {vis.map((it) => (
                  <button
                    key={it.id}
                    className="btn g sm mais-item"
                    onClick={() => {
                      fecha();
                      go(it.id);
                    }}
                  >
                    {/* o ícone com a cor do item, como na barra lateral (Silva, 20/10/2026) */}
                    <i className={ico(it.fa) + (it.c ? ' ' + it.c : '')} style={it.c ? { color: 'var(--c)' } : undefined} />
                    {t(it.t)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
    </>
  );
}
