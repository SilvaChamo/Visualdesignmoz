'use client';

// Janelas (na maquete: openM(...) com o HTML de cada formulário).
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
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
/** Bandeirinhas da língua (desenhadas aqui: os emojis de bandeiras não aparecem em todos os sistemas) */
function Bandeira({ l }: { l: 'pt' | 'en' }) {
  const corte = useId();
  if (l === 'pt')
    return (
      <svg className="lingua-bandeira" viewBox="0 0 30 20" aria-hidden>
        <rect width="12" height="20" fill="#046a38" />
        <rect x="12" width="18" height="20" fill="#da291c" />
        <circle cx="12" cy="10" r="4.2" fill="#ffe900" />
        <path d="M10.2 7.6h3.6v3.3a1.8 1.8 0 0 1-3.6 0z" fill="#fff" stroke="#da291c" strokeWidth=".7" />
      </svg>
    );
  return (
    <svg className="lingua-bandeira" viewBox="0 0 60 30" aria-hidden>
      <clipPath id={corte}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${corte})`} stroke="#c8102e" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  );
}

/** Seletor da língua: um só botão com a bandeira e a abreviatura da língua escolhida; ao abrir, as duas línguas
 *  (Silva, 14/10/2026: em vez dos dois botões Português | English) */
function SeletorLingua() {
  const { s, setLang } = useVH();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent | TouchEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('touchstart', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('touchstart', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);
  const linguas = [
    ['pt', 'PT', 'Português'],
    ['en', 'EN', 'English'],
  ] as const;
  const atual = linguas.find(([k]) => k === s.lang) || linguas[0];
  return (
    <div className="lingua-sel" ref={caixa}>
      <button type="button" className={'btn g sm lingua-btn' + (aberto ? ' on' : '')} onClick={() => setAberto(!aberto)} aria-haspopup="listbox" aria-expanded={aberto} title={atual[2]}>
        <Bandeira l={atual[0]} />
        {atual[1]}
        <i className="fa-solid fa-chevron-down" />
      </button>
      {aberto && (
        <div className="lingua-menu" role="listbox">
          {linguas.map(([k, ab, nome]) => (
            <button
              key={k}
              type="button"
              role="option"
              aria-selected={s.lang === k}
              className={s.lang === k ? 'on' : ''}
              onClick={() => {
                setAberto(false);
                setLang(k);
              }}
            >
              <Bandeira l={k} />
              <b>{ab}</b>
              <span>{nome}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MoreMenuModal() {
  const { s, t, allowed, hasFeat, closeM, setLevel, go } = useVH();
  return (
    <>
      <h3>{t('Menu')}</h3>
      {/* uma só linha: Admin | Gestão à esquerda e a língua à direita (Silva, 14/10/2026) */}
      <div className="mais-topo">
        <div className="mais-niveis">
          {allowed.length > 1 &&
            allowed.map((k) => (
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
        <SeletorLingua />
      </div>
      {MENU[s.level]
        .filter(([g]) => g !== 'Início')
        .map(([g, items]) => {
          const vis = items.filter((it) => hasFeat(it.feat));
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
