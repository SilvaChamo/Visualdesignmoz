'use client';

/**
 * Gerir WordPress › Gestão › «Opções do WordPress» (Silva, 31/10/2026): ícone do site (favicon), Leitura (página inicial) e Ligações permanentes.
 * `guardar` faz a alteração no servidor (devolve true se correu bem); a página recarrega a leitura depois.
 */
import { useRef, useState } from 'react';
import { useVH } from '../context';
import { Confirmar } from './pacotes';

export type OpcoesWp = { icone: string; mostra: 'posts' | 'page'; inicial: number; artigos: number; ligacoes: string; paginas: { ID: number; t: string }[] };
/** Estruturas das ligações permanentes (as do WordPress): chave → estrutura gravada e nome */
const LIGACOES: [string, string, string][] = [
  ['simples', '', 'Simples (?p=123)'],
  ['dia', '/%year%/%monthnum%/%day%/%postname%/', 'Dia e nome (/2026/10/31/artigo-de-exemplo/)'],
  ['mes', '/%year%/%monthnum%/%postname%/', 'Mês e nome (/2026/10/artigo-de-exemplo/)'],
  ['numerica', '/archives/%post_id%', 'Numérica (/archives/123)'],
  ['nome', '/%postname%/', 'Nome do artigo (/artigo-de-exemplo/)'],
];

export function OpcoesWordPress({ d, dados, recarregar, guardar }: { d: string; dados: OpcoesWp; recarregar: () => void; guardar: (corpo: Record<string, unknown>, ok: string) => Promise<boolean> }) {
  const vh = useVH();
  const { t, openM } = vh;
  const chaveLig = LIGACOES.find((x) => x[1] === dados.ligacoes)?.[0] || 'personalizada';
  const [mostra, setMostra] = useState<'posts' | 'page'>(dados.mostra);
  const [inicial, setInicial] = useState(dados.inicial || dados.paginas[0]?.ID || 0);
  const [artigos, setArtigos] = useState(dados.artigos);
  const [lig, setLig] = useState(chaveLig);
  const [aEnviar, setAEnviar] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
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
  const mudouLeitura = mostra !== dados.mostra || (mostra === 'page' && (inicial !== dados.inicial || artigos !== dados.artigos));
  const mudouLig = lig !== chaveLig;
  return (
    <section className="da-sec">
      <div className="seccao-h">
        <div>
          <h3>{t('Opções do WordPress')}</h3>
        </div>
      </div>
      <div className="em-opcoes">
        <div>
          <span>
            {t('Ícone do site (favicon)')}
            <small>{t('A imagem que aparece no separador do navegador. Use uma imagem quadrada (PNG, JPG, GIF, WebP ou ICO).')}</small>
          </span>
          <span className="wpo-icone">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {dados.icone ? <img src={dados.icone} alt={t('Ícone do site (favicon)')} width={32} height={32} /> : <i className="fa-regular fa-image" />}
            <input ref={entrada} type="file" hidden accept=".png,.jpg,.jpeg,.gif,.webp,.ico,image/*" onChange={(e) => trocarIcone(e.target.files?.[0])} />
            <button className="btn sm g" type="button" disabled={aEnviar} onClick={() => entrada.current?.click()}>
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
            {t('Leitura: a página inicial mostra')}
            <small>{t('Escolha os artigos mais recentes ou uma página estática como página principal da home.')}</small>
          </span>
          <span className="wpo-campos">
            <select className="em-sel" value={mostra} onChange={(e) => setMostra(e.target.value as 'posts' | 'page')} aria-label={t('A página inicial mostra')}>
              <option value="posts">{t('Os artigos mais recentes')}</option>
              <option value="page">{t('Uma página estática')}</option>
            </select>
            {mostra === 'page' && (
              <>
                <select className="em-sel" value={inicial} onChange={(e) => setInicial(Number(e.target.value))} aria-label={t('Página inicial')}>
                  {dados.paginas.map((p) => (
                    <option key={p.ID} value={p.ID}>
                      {t('Página inicial')}: {p.t || '#' + p.ID}
                    </option>
                  ))}
                </select>
                <select className="em-sel" value={artigos} onChange={(e) => setArtigos(Number(e.target.value))} aria-label={t('Página dos artigos')}>
                  <option value={0}>{t('Página dos artigos')}: {t('nenhuma')}</option>
                  {dados.paginas
                    .filter((p) => p.ID !== inicial)
                    .map((p) => (
                      <option key={p.ID} value={p.ID}>
                        {t('Página dos artigos')}: {p.t || '#' + p.ID}
                      </option>
                    ))}
                </select>
              </>
            )}
            <button className="btn sm r" type="button" disabled={!mudouLeitura || (mostra === 'page' && !inicial)} onClick={async () => (await guardar({ acao: 'wp-leitura', mostra, inicial, artigos: artigos === inicial ? 0 : artigos }, 'Guardado')) && recarregar()}>
              {t('Guardar')}
            </button>
          </span>
        </div>
        <div>
          <span>
            {t('Ligações permanentes')}
            <small>{t('A forma dos endereços das páginas e dos artigos. Ao guardar, as regras do site são refeitas.')}</small>
          </span>
          <span className="wpo-campos">
            <select className="em-sel" value={lig} onChange={(e) => setLig(e.target.value)} aria-label={t('Ligações permanentes')}>
              {lig === 'personalizada' && (
                <option value="personalizada" disabled>
                  {t('Personalizada')}: {dados.ligacoes}
                </option>
              )}
              {LIGACOES.map(([k, , nome]) => (
                <option key={k} value={k}>
                  {t(nome)}
                </option>
              ))}
            </select>
            <button className="btn sm r" type="button" disabled={!mudouLig || lig === 'personalizada'} onClick={async () => (await guardar({ acao: 'wp-ligacoes', estrutura: lig }, 'Guardado')) && recarregar()}>
              {t('Guardar')}
            </button>
          </span>
        </div>
      </div>
    </section>
  );
}

