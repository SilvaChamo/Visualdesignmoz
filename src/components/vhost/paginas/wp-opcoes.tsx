'use client';

/**
 * Gerir WordPress › Gestão: opções do WordPress em linhas, por baixo da linha do selector «Atualização automática do WordPress», no mesmo bloco e com
 * o mesmo desenho (Silva, 31/10/2026: «mantém tudo como está e acrescenta em baixo da linha; não quero selectores sem fim»): ícone do site (favicon),
 * página principal da home (um interruptor) e ligações permanentes (botões de um clique). Devolve só as linhas: vão dentro do `.em-opcoes` da página.
 * `guardar` faz a alteração no servidor (devolve true se correu bem); a página recarrega a leitura depois.
 */
import { useRef, useState } from 'react';
import { useVH } from '../context';
import { Switch } from './componentes';
import { Confirmar } from './pacotes';

export type OpcoesWp = { icone: string; mostra: 'posts' | 'page'; inicial: number; artigos: number; ligacoes: string; paginas: { ID: number; t: string }[] };
/** Estruturas das ligações permanentes (as do WordPress): chave, estrutura gravada, nome e exemplo */
const LIGACOES: [string, string, string, string][] = [
  ['simples', '', 'Simples', '?p=123'],
  ['dia', '/%year%/%monthnum%/%day%/%postname%/', 'Dia e nome', '/2026/10/31/artigo-de-exemplo/'],
  ['mes', '/%year%/%monthnum%/%postname%/', 'Mês e nome', '/2026/10/artigo-de-exemplo/'],
  ['numerica', '/archives/%post_id%', 'Numérica', '/archives/123'],
  ['nome', '/%postname%/', 'Nome do artigo', '/artigo-de-exemplo/'],
];

type Guardar = (corpo: Record<string, unknown>, ok: string) => Promise<boolean>;

/** Janela para escolher a página principal da home: uma lista, um clique */
function EscolherPagina({ paginas, atual, aoEscolher }: { paginas: OpcoesWp['paginas']; atual: number; aoEscolher: (id: number) => void }) {
  const { t, closeM } = useVH();
  return (
    <>
      <h3>{t('Página principal da home')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 10 }}>{t('Escolha a página que o site mostra na home.')}</p>
      <div className="wpo-lista">
        {paginas.map((p) => (
          <button
            key={p.ID}
            type="button"
            className={'wpo-item' + (p.ID === atual ? ' on' : '')}
            onClick={() => {
              closeM();
              aoEscolher(p.ID);
            }}
          >
            <i className={'fa-solid ' + (p.ID === atual ? 'fa-circle-check' : 'fa-file-lines')} />
            {p.t || '#' + p.ID}
          </button>
        ))}
      </div>
      <div className="mfoot">
        <button className="btn g" type="button" onClick={closeM}>
          {t('Cancelar')}
        </button>
      </div>
    </>
  );
}

export function OpcoesWordPress({ d, dados, recarregar, guardar }: { d: string; dados: OpcoesWp; recarregar: () => void; guardar: Guardar }) {
  const vh = useVH();
  const { t, openM } = vh;
  const [aEnviar, setAEnviar] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const chaveLig = LIGACOES.find((x) => x[1] === dados.ligacoes)?.[0] || '';
  const paginaInicial = dados.paginas.find((p) => p.ID === dados.inicial);

  const trocarIcone = async (f: File | undefined) => {
    if (!f || aEnviar) return;
    setAEnviar(true);
    vh.toast('A alterar no servidor…');
    try {
      const fd = new FormData();
      fd.append('conta', vh.me);
      fd.append('dominio', d);
      fd.append('acao', 'wp-icone');
      fd.append('ficheiro', f);
      const r = await fetch('/api/vhost/avancado', { method: 'POST', body: fd });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      vh.toast(r.ok ? 'Ícone do site alterado' : String(j.erro || 'A alteração falhou'));
      if (r.ok) recarregar();
    } catch {
      vh.toast('Sem ligação ao site. Nada foi alterado.');
    } finally {
      setAEnviar(false);
      if (entrada.current) entrada.current.value = '';
    }
  };
  const escolherPagina = () => {
    if (!dados.paginas.length) return vh.toast(t('Este site ainda não tem páginas publicadas.'));
    openM(
      <EscolherPagina
        paginas={dados.paginas}
        atual={dados.inicial}
        aoEscolher={async (id) => (await guardar({ acao: 'wp-leitura', mostra: 'page', inicial: id, artigos: dados.artigos === id ? 0 : dados.artigos }, 'Guardado')) && recarregar()}
      />,
    );
  };
  const mudarLigacoes = (chave: string, nome: string) =>
    openM(
      <Confirmar
        titulo="Mudar as ligações permanentes?"
        texto={t('Os endereços das páginas e dos artigos passam a ser') + ' «' + nome + '». ' + t('Os endereços antigos podem deixar de abrir.')}
        ok="Mudar"
        onOk={async () => (await guardar({ acao: 'wp-ligacoes', estrutura: chave }, 'Guardado')) && recarregar()}
      />,
    );

  return (
    <>
      <div>
        <span>
          {t('Ícone do site (favicon)')}
          <small>{t('A imagem do separador do navegador (quadrada).')}</small>
        </span>
        <span className="wpo-icone">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {dados.icone ? <img src={dados.icone} alt={t('Ícone do site (favicon)')} width={28} height={28} /> : <i className="fa-regular fa-image" />}
          <input ref={entrada} type="file" hidden accept=".png,.jpg,.jpeg,.gif,.webp,.ico,image/*" onChange={(e) => trocarIcone(e.target.files?.[0])} />
          <button className="btn sm btn-ed" type="button" disabled={aEnviar} onClick={() => entrada.current?.click()}>
            <i className="fa-solid fa-upload" />
            {t(aEnviar ? 'A enviar…' : 'Trocar ícone')}
          </button>
          {dados.icone && (
            <button
              className="btn sm btn-rm"
              type="button"
              disabled={aEnviar}
              onClick={() => openM(<Confirmar titulo="Remover o ícone do site?" texto="O site fica sem ícone no separador do navegador." ok="Remover" onOk={async () => (await guardar({ acao: 'wp-icone-remover' }, 'Ícone removido')) && recarregar()} />)}
            >
              {t('Remover')}
            </button>
          )}
        </span>
      </div>
      <div>
        <span>
          {t('Página principal da home')}
          <small>{t(dados.mostra === 'page' ? 'Ligado: a home mostra uma página. Desligado: mostra os artigos mais recentes.' : 'Desligado: a home mostra os artigos mais recentes. Ligue para usar uma página.')}</small>
        </span>
        <span className="wpo-icone">
          {dados.mostra === 'page' && (
            <button className="wpo-pag" type="button" onClick={escolherPagina}>
              <i className="fa-solid fa-file-lines" />
              {paginaInicial?.t || '#' + dados.inicial}
              <small>{t('Mudar')}</small>
            </button>
          )}
          <Switch
            checked={dados.mostra === 'page'}
            label="Página principal da home"
            onChange={async (v) => (v ? escolherPagina() : (await guardar({ acao: 'wp-leitura', mostra: 'posts' }, 'Guardado')) && recarregar())}
          />
        </span>
      </div>
      <div>
        <span>
          {t('Ligações permanentes')}
          <small>{t('A forma dos endereços das páginas e dos artigos.')}</small>
        </span>
        <span className="wpo-chips">
          {LIGACOES.map(([k, , nome, exemplo]) => (
            <button key={k} type="button" className={'wpo-chip' + (k === chaveLig ? ' on' : '')} title={exemplo} aria-pressed={k === chaveLig} onClick={() => k !== chaveLig && mudarLigacoes(k, t(nome))}>
              {t(nome)}
            </button>
          ))}
          {!chaveLig && (
            <small className="wpo-pers">
              {t('Personalizada')}: {dados.ligacoes}
            </small>
          )}
        </span>
      </div>
    </>
  );
}
