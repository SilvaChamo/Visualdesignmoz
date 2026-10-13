'use client';

// Lupa da barra de cima (pedido do Silva, 13/10/2026): procura na página aberta — Domínios procura nos domínios, E-mail
// nas contas de e-mail, etc. (cada tabela da página regista as suas linhas, ver DataTable); na página inicial procura no
// painel todo (funcionalidades e domínios). Desliza por baixo da faixa do seletor, com a largura toda, num cartão com
// o campo e os resultados por baixo. A lupa da barra compacta continua a abrir a janela de pesquisa (Ctrl+K).
import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { ItemPesquisa } from './context';

type Estado = { aberta: boolean; q: string; i: number };
const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function PesquisaNaPagina({
  t,
  geral,
  titulo,
  fontes,
  gerais,
  estado,
  mudar,
  abrirPopup,
}: {
  t: (x: string) => string;
  /** página inicial: procura no painel todo */
  geral: boolean;
  titulo: string;
  /** as linhas das tabelas da página aberta */
  fontes: () => ItemPesquisa[];
  /** funcionalidades e domínios (página inicial, ou página sem tabelas) */
  gerais: (q: string) => ItemPesquisa[];
  estado: Estado;
  mudar: Dispatch<SetStateAction<Estado>>;
  abrirPopup: (q: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const palavras = norm(estado.q.trim()).split(/\s+/).filter(Boolean);
  const daPagina = geral ? [] : fontes();
  const naPagina = daPagina.length > 0;
  const itens = (naPagina ? daPagina.filter((x) => palavras.every((w) => norm(x.txt).includes(w))) : gerais(estado.q)).slice(0, 60);
  const i = Math.min(estado.i, Math.max(0, itens.length - 1));
  const fechar = () => mudar({ aberta: false, q: '', i: 0 });
  const escolher = (n: number) => {
    const x = itens[n];
    if (!x) return;
    fechar();
    x.ir();
  };
  const teclas = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      mudar((s) => ({ ...s, i: Math.min(itens.length - 1, i + 1) }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      mudar((s) => ({ ...s, i: Math.max(0, i - 1) }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      escolher(i);
    } else if (e.key === 'Escape') fechar();
  };
  const onde = geral || !naPagina ? t('Painel') : t(titulo);
  return (
    <div className="pesq-pag" role="search">
      <div className="pesq-pag-card">
        <div className="pesq-pag-in">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            ref={ref}
            value={estado.q}
            onChange={(e) => mudar({ aberta: true, q: e.target.value, i: 0 })}
            onKeyDown={teclas}
            placeholder={geral || !naPagina ? t('Pesquisar no painel (funcionalidades, domínios…)') : t('Pesquisar em') + ' ' + t(titulo) + '…'}
            autoComplete="off"
            aria-label={t('Pesquisar')}
          />
          <span className="pesq-onde">{onde}</span>
          <button onClick={fechar} title={t('Fechar')} aria-label={t('Fechar')}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="pesq-pag-lista">
          {itens.length ? (
            itens.map((x, n) => (
              <div key={x.k} className={'pesq-pag-it' + (n === i ? ' on' : '')} onMouseEnter={() => mudar((s) => ({ ...s, i: n }))} onClick={() => escolher(n)}>
                <span className={'ic ' + (x.c || 'c3')}>
                  <i className={x.fa || 'fa-solid fa-table-list'} />
                </span>
                <div>
                  <b>{x.txt}</b>
                  <span>{x.sub || t(titulo)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="pesq-pag-vazio">{t(naPagina ? 'Nada encontrado nesta página.' : 'Nada encontrado.')}</div>
          )}
        </div>
        {naPagina && (
          <div className="pesq-pag-pe">
            <a onClick={() => abrirPopup(estado.q)}>
              <i className="fa-solid fa-magnifying-glass" />
              {t('Procurar no painel todo')} <kbd>Ctrl K</kbd>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
