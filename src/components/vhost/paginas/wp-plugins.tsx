'use client';

/**
 * Gerir WordPress › Plugins (Silva, 31/10/2026). O cabeçalho é o de sempre da página (título, números, «Atualizar todos os plugins») com o botão
 * «Adicionar plugin» logo a seguir; por baixo, a lista como a do WordPress: caixas de selecção, acções de cada plugin por baixo do nome e
 * «Acções por lote» + «Aplicar» por cima e por baixo. «Adicionar plugin» troca tudo pelo ecrã «Adicionar plugins» do WordPress (igual), onde se
 * carregam vários .zip de uma vez. As alterações vão ao servidor pelas funções que a página passa.
 */
import { useRef, useState } from 'react';
import { useVH } from '../context';
import { Confirmar } from './pacotes';

export type PluginWp = { name: string; title?: string; status: string; version: string; update: string | null; update_version?: string };
export type OpPluginWp = 'ativar' | 'desativar' | 'atualizar' | 'apagar';
type Filtro = 'todos' | 'ativos' | 'inativos' | 'atualizacoes';
type Lote = '' | OpPluginWp;
type Resultado = { nome: string; estado: 'espera' | 'a-enviar' | 'ok' | 'erro'; detalhe?: string };

const ativo = (p: PluginWp) => p.status === 'active';
const comAtualizacao = (p: PluginWp) => p.update === 'available';

/** `executar`: faz a operação no servidor para estes plugins (true se correu bem). `atualizarTodos`: «Atualizar todos os plugins». `enviar`: instala um .zip (devolve o erro, ou null se correu bem). */
export function PluginsWp({
  plugins,
  executar,
  atualizarTodos,
  enviar,
  recarregar,
}: {
  plugins: PluginWp[];
  executar: (op: OpPluginWp, nomes: string[]) => Promise<boolean>;
  atualizarTodos: () => Promise<boolean>;
  enviar: (ficheiro: File) => Promise<string | null>;
  recarregar: () => void;
}) {
  const { t, toast, openM } = useVH();
  const [vista, setVista] = useState<'lista' | 'adicionar'>('lista');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [sel, setSel] = useState<string[]>([]);
  const [loteCima, setLoteCima] = useState<Lote>('');
  const [loteBaixo, setLoteBaixo] = useState<Lote>('');
  const [ficheiros, setFicheiros] = useState<File[]>([]);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [aEnviar, setAEnviar] = useState(false);
  const [aTrabalhar, setATrabalhar] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const contagem: Record<Filtro, number> = {
    todos: plugins.length,
    ativos: plugins.filter(ativo).length,
    inativos: plugins.filter((p) => !ativo(p)).length,
    atualizacoes: plugins.filter(comAtualizacao).length,
  };
  const visiveis = plugins.filter((p) => (filtro === 'ativos' ? ativo(p) : filtro === 'inativos' ? !ativo(p) : filtro === 'atualizacoes' ? comAtualizacao(p) : true));
  const nomesVisiveis = visiveis.map((p) => p.name);
  const todos = nomesVisiveis.length > 0 && nomesVisiveis.every((n) => sel.includes(n));
  const alternarTodos = () => setSel(todos ? sel.filter((n) => !nomesVisiveis.includes(n)) : Array.from(new Set([...sel, ...nomesVisiveis])));

  const correr = async (op: OpPluginWp, nomes: string[]) => {
    if (aTrabalhar) return;
    setATrabalhar(true);
    try {
      if (await executar(op, nomes)) setSel((s) => s.filter((n) => !nomes.includes(n)));
    } finally {
      setATrabalhar(false);
    }
  };
  const todosAtualizar = async () => {
    if (aTrabalhar) return;
    setATrabalhar(true);
    try {
      await atualizarTodos();
    } finally {
      setATrabalhar(false);
    }
  };
  const apagar = (nomes: string[]) =>
    openM(
      <Confirmar
        titulo={nomes.length === 1 ? 'Eliminar o plugin?' : 'Eliminar os plugins escolhidos?'}
        texto={(nomes.length === 1 ? plugins.find((p) => p.name === nomes[0])?.title || nomes[0] : String(nomes.length)) + ' ' + t('será eliminado deste site. Não se pode desfazer.')}
        ok="Eliminar"
        onOk={() => correr('apagar', nomes)}
      />,
    );
  const aplicar = (acao: Lote, limpar: () => void) => {
    if (!sel.length) return toast(t('Escolha pelo menos um plugin.'));
    if (!acao) return toast(t('Escolha uma acção por lote.'));
    const escolhidos = plugins.filter((p) => sel.includes(p.name));
    const servem = escolhidos.filter((p) => (acao === 'ativar' ? !ativo(p) : acao === 'desativar' ? ativo(p) : acao === 'atualizar' ? comAtualizacao(p) : !ativo(p)));
    if (!servem.length) return toast(t(acao === 'apagar' ? 'Só se eliminam plugins inactivos: desactive-os primeiro.' : 'Nenhum dos plugins escolhidos precisa desta acção.'));
    limpar();
    if (acao === 'apagar') return apagar(servem.map((p) => p.name));
    void correr(acao, servem.map((p) => p.name));
  };

  const instalar = async () => {
    if (!ficheiros.length || aEnviar) return;
    setAEnviar(true);
    const lista: Resultado[] = ficheiros.map((f) => ({ nome: f.name, estado: 'espera' }));
    setResultados(lista);
    for (let i = 0; i < ficheiros.length; i++) {
      lista[i] = { ...lista[i], estado: 'a-enviar' };
      setResultados([...lista]);
      const erro = await enviar(ficheiros[i]);
      lista[i] = erro ? { nome: ficheiros[i].name, estado: 'erro', detalhe: erro } : { nome: ficheiros[i].name, estado: 'ok' };
      setResultados([...lista]);
    }
    setAEnviar(false);
    setFicheiros([]);
    if (entrada.current) entrada.current.value = '';
    recarregar();
  };

  if (vista === 'adicionar') {
    // O ecrã «Adicionar plugins» do WordPress, igual: título, «Carregar plugin», texto ao centro, caixa com o campo de ficheiros e «Instalar agora», nota em baixo.
    return (
      <section className="da-sec wpp">
        <div className="wpp-wp">
          <div className="wpp-wp-cab">
            <h1>{t('Adicionar plugins')}</h1>
            <button className="wpp-wp-btn on" type="button" onClick={() => entrada.current?.click()}>
              {t('Carregar plugin')}
            </button>
            <button
              className="wpp-lnk wpp-voltar"
              type="button"
              onClick={() => {
                setVista('lista');
                setResultados([]);
                setFicheiros([]);
              }}
            >
              <i className="fa-solid fa-arrow-left" /> {t('Voltar aos plugins')}
            </button>
          </div>
          <p className="wpp-wp-ajuda">{t('Se tem um plugin no formato .zip pode instalá-lo ou actualizá-lo carregando-o aqui.')}</p>
          <div className="wpp-wp-form">
            <input
              ref={entrada}
              type="file"
              multiple
              accept=".zip,application/zip,application/x-zip-compressed"
              data-ic-sem
              aria-label={t('Escolher ficheiros')}
              disabled={aEnviar}
              onChange={(e) => {
                setResultados([]);
                setFicheiros(Array.from(e.target.files || []).filter((f) => /\.zip$/i.test(f.name)));
              }}
            />
            <button className={'wpp-wp-btn' + (ficheiros.length && !aEnviar ? '' : ' off')} type="button" disabled={!ficheiros.length || aEnviar} onClick={instalar}>
              {t(aEnviar ? 'A instalar…' : 'Instalar agora')}
            </button>
          </div>
          {resultados.length > 0 && (
            <ul className="wpp-wp-res">
              {resultados.map((r, i) => (
                <li key={r.nome + i} className={r.estado}>
                  <i className={'fa-solid ' + (r.estado === 'ok' ? 'fa-circle-check' : r.estado === 'erro' ? 'fa-circle-xmark' : r.estado === 'a-enviar' ? 'fa-spinner fa-spin' : 'fa-file-zipper')} />
                  <span>{r.nome}</span>
                  {r.estado === 'ok' && <small>{t('Instalado')}</small>}
                  {r.estado === 'erro' && <small className="erro">{r.detalhe}</small>}
                </li>
              ))}
            </ul>
          )}
          <p className="wpp-wp-rodape">
            {t('Os plugins expandem as funcionalidades do WordPress. Pode instalar plugins do')}{' '}
            <a href="https://wordpress.org/plugins/" target="_blank" rel="noopener noreferrer">
              {t('directório de plugins do WordPress')}
            </a>{' '}
            {t('nesta página, ou carregá-los em formato .zip, clicando no botão acima.')}
          </p>
        </div>
      </section>
    );
  }

  const barra = (valor: Lote, mudar: (v: Lote) => void, id: string) => (
    <div className="wpp-barra">
      <select className="em-sel wpp-sel" value={valor} onChange={(e) => mudar(e.target.value as Lote)} aria-label={t('Acções por lote')} data-ic-sem id={id}>
        <option value="">{t('Acções por lote')}</option>
        <option value="ativar">{t('Activar')}</option>
        <option value="desativar">{t('Desactivar')}</option>
        <option value="atualizar">{t('Actualizar')}</option>
        <option value="apagar">{t('Eliminar')}</option>
      </select>
      <button className="btn sm wpp-aplicar" type="button" disabled={aTrabalhar} onClick={() => aplicar(valor, () => mudar(''))}>
        {t('Aplicar')}
      </button>
      <span className="wpp-itens">
        {visiveis.length} {t(visiveis.length === 1 ? 'item' : 'itens')}
      </span>
    </div>
  );
  const filtros: [Filtro, string][] = [
    ['todos', 'Todos'],
    ['ativos', 'Activos'],
    ['inativos', 'Inactivos'],
    ['atualizacoes', 'Com actualização'],
  ];

  return (
    <section className="da-sec wpp">
      <div className="seccao-h">
        <div>
          <h3>{t('Plugins')}</h3>
        </div>
        <div className="numeros">
          <span>
            {t('Plugins')} <b>{plugins.length}</b>
          </span>
          <span>
            {t('Com atualização')} <b>{contagem.atualizacoes}</b>
          </span>
          <button className="btn sm r" type="button" disabled={!contagem.atualizacoes || aTrabalhar} onClick={todosAtualizar}>
            <i className="fa-solid fa-arrows-rotate" />
            {t('Atualizar todos os plugins')}
          </button>
          <button className="btn sm wpp-novo" type="button" onClick={() => setVista('adicionar')}>
            <i className="fa-solid fa-plus" />
            {t('Adicionar plugin')}
          </button>
        </div>
      </div>
      <ul className="wpp-filtros">
        {filtros.map(([k, nome]) => (
          <li key={k}>
            <button className={'wpp-lnk' + (filtro === k ? ' on' : '')} type="button" onClick={() => setFiltro(k)}>
              {t(nome)} <span>({contagem[k]})</span>
            </button>
          </li>
        ))}
      </ul>
      {barra(loteCima, setLoteCima, 'wpp-lote-cima')}
      <div data-dt="wp-plugins" className="tbl dt dt-empilhar wpp-tabela">
        <table>
          <thead>
            <tr>
              <th className="ck" data-t={t('Selecionar tudo')}>
                <input type="checkbox" aria-label={t('Selecionar tudo')} checked={todos} disabled={!nomesVisiveis.length} onChange={alternarTodos} />
              </th>
              <th>{t('Plugin')}</th>
              <th>{t('Versão')}</th>
              <th>{t('Estado')}</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length ? (
              visiveis.map((p) => {
                const on = sel.includes(p.name);
                return (
                  <tr key={p.name} className={on ? 'sel' : undefined}>
                    <td className="ck">
                      <input type="checkbox" aria-label={t('Selecionar')} checked={on} onChange={() => setSel(on ? sel.filter((n) => n !== p.name) : [...sel, p.name])} />
                    </td>
                    <td data-t={t('Plugin')}>
                      <b style={comAtualizacao(p) ? { color: 'var(--red)' } : undefined}>{p.title || p.name}</b>
                      <div className="wpp-acoes">
                        <button className="wpp-lnk" type="button" disabled={aTrabalhar} onClick={() => correr(ativo(p) ? 'desativar' : 'ativar', [p.name])}>
                          {t(ativo(p) ? 'Desactivar' : 'Activar')}
                        </button>
                        {comAtualizacao(p) && (
                          <>
                            <span>|</span>
                            <button className="wpp-lnk" type="button" disabled={aTrabalhar} onClick={() => correr('atualizar', [p.name])}>
                              {t('Actualizar')}
                            </button>
                          </>
                        )}
                        {!ativo(p) && (
                          <>
                            <span>|</span>
                            <button className="wpp-lnk wpp-apagar" type="button" disabled={aTrabalhar} onClick={() => apagar([p.name])}>
                              {t('Eliminar')}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    <td data-t={t('Versão')}>{p.version + (comAtualizacao(p) ? ' → ' + (p.update_version || '') : '')}</td>
                    <td data-t={t('Estado')}>
                      <span className={'tag ' + (ativo(p) ? 'ok' : 'off')}>{t(ativo(p) ? 'Activo' : 'Inactivo')}</span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="empty">
                  {t(plugins.length ? 'Nada encontrado' : 'Sem plugins')}
                </td>
              </tr>
            )}
          </tbody>
          {visiveis.length > 0 && (
            <tfoot>
              <tr>
                <th className="ck">
                  <input type="checkbox" aria-label={t('Selecionar tudo')} checked={todos} onChange={alternarTodos} />
                </th>
                <th>{t('Plugin')}</th>
                <th>{t('Versão')}</th>
                <th>{t('Estado')}</th>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {barra(loteBaixo, setLoteBaixo, 'wpp-lote-baixo')}
    </section>
  );
}
