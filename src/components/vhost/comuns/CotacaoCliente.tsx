'use client'

// Cotação ao cliente, no fim das tabelas da calculadora de custo de importação. Usa o preço de venda de cada produto
// (o custo por unidade já com a margem bruta pretendida) e monta o documento igual às cotações da VisualDesign
// (cabeçalho, caixa do cliente, tabela, total a pagar, aprovação do cliente e rodapé). Os campos do cliente, do prazo e
// do pagamento escrevem-se aqui; «Imprimir ou guardar em PDF» abre o documento sozinho numa janela, pronto a imprimir.

import { useEffect, useRef, useState } from 'react'
import { Plus, Printer, Trash2 } from 'lucide-react'
import { gravarEstado, lerEstado } from './estado-calculadora'
import { Miniatura, useFotosProdutos } from './fotos-produtos'

export interface ItemCotacao {
  id: number
  nome: string
  unidades: number
  /** preço de venda por unidade, sem IVA (o custo por unidade com a margem bruta) */
  preco: number
}

// as peças de interface são as da calculadora (copiadas, para não haver importações a andar em círculo)
const CAMPO =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
const ROTULO = 'mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400'
const CARTAO = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 @xl:p-6'
const TITULO = 'text-lg font-bold text-slate-900 dark:text-slate-100'
const NOTA = 'text-xs leading-relaxed text-slate-500 dark:text-slate-400'
const VERMELHO = '#b00020'

const ID_DOCUMENTO = 'cci-cotacao-documento'
// campo de texto em linha dentro da tabela: parece texto até se passar o rato ou escrever
const EDITAR = 'w-full min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-inherit outline-none transition hover:border-zinc-300 focus:border-red-500 focus:bg-white'

function CampoTexto({ id, rotulo, valor, aoMudar, tipo = 'text', exemplo }: { id: string; rotulo: string; valor: string; aoMudar: (v: string) => void; tipo?: 'text' | 'number'; exemplo?: string }) {
  return (
    <div>
      <label htmlFor={id} className={ROTULO}>
        {rotulo}
      </label>
      <input id={id} type={tipo} {...(tipo === 'number' ? { inputMode: 'decimal' as const, min: 0, step: 'any' } : {})} value={valor} placeholder={exemplo} onChange={(e) => aoMudar(e.target.value)} className={CAMPO} />
    </div>
  )
}

/** 35968 → «35 968,00» (espaço fixo a separar os milhares, como nas cotações da VisualDesign) */
function valor2(n: number): string {
  if (!Number.isFinite(n)) return '–'
  const [inteiro, dec] = (Math.round(n * 100) / 100).toFixed(2).split('.')
  return `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${dec}`
}

const arredondar2 = (n: number) => Math.round(n * 100) / 100
const lerNumero = (s: string, padrao: number) => {
  const v = Number(s.trim().replace(',', '.'))
  return s.trim() !== '' && Number.isFinite(v) && v >= 0 ? v : padrao
}

export function CotacaoCliente({ itens, moeda, aoRemover }: { itens: ItemCotacao[]; moeda: string; aoRemover?: (id: number) => void }) {
  const [cliente, setCliente] = useState('')
  const [contacto, setContacto] = useState('')
  const [numero, setNumero] = useState('')
  const [data, setData] = useState('')
  const [validade, setValidade] = useState('10')
  const [prazo, setPrazo] = useState('')
  const [pagamento, setPagamento] = useState('')
  const [ivaIncluido, setIvaIncluido] = useState(true)
  const [ivaPct, setIvaPct] = useState('16')
  const [personalizacao, setPersonalizacao] = useState<Record<number, string>>({})
  // a tabela da cotação edita-se aqui, sem mexer na calculadora: o que se escreve numa linha (nome, quantidade, preço) vale só para a cotação, as linhas
  // podem ser eliminadas e acrescentam-se outras; o que não se editou continua a seguir a calculadora
  const [edicoes, setEdicoes] = useState<Record<number, { nome?: string; unidades?: string; preco?: string }>>({})
  const [aviso, setAviso] = useState('')
  // a tabela só mostra os campos editáveis e o eliminar/adicionar quando se clica em «Editar»; «Gravar» guarda e volta à vista normal
  const [editar, setEditar] = useState(false)

  // «Gravar»: guarda a cotação editada (campos, tabela, personalização) no servidor (tabela calculadora_estado) e volta a pô-la ao abrir
  const estado = { cliente, contacto, numero, validade, prazo, pagamento, ivaIncluido, ivaPct, personalizacao, edicoes }
  const cargaFeita = useRef(false)
  useEffect(() => {
    if (cargaFeita.current) return
    cargaFeita.current = true
    lerEstado<Partial<typeof estado>>('cotacao').then((g) => {
      if (g) {
        setCliente(g.cliente ?? '')
        setContacto(g.contacto ?? '')
        setNumero(g.numero ?? '')
        setValidade(g.validade ?? '10')
        setPrazo(g.prazo ?? '')
        setPagamento(g.pagamento ?? '')
        setIvaIncluido(g.ivaIncluido ?? true)
        setIvaPct(g.ivaPct ?? '16')
        setPersonalizacao(g.personalizacao ?? {})
        setEdicoes(g.edicoes ?? {})
      }
    })
  }, [])
  const gravar = async () => {
    const ok = await gravarEstado('cotacao', estado)
    if (!ok) setAviso('Não foi possível gravar a cotação no servidor.')
    return ok
  }

  // a data de hoje (só no navegador, para o servidor e o navegador não discordarem)
  useEffect(() => {
    const h = new Date()
    setData(`${String(h.getDate()).padStart(2, '0')}/${String(h.getMonth() + 1).padStart(2, '0')}/${h.getFullYear()}`)
  }, [])

  const ano = new Date().getFullYear()
  const iva = lerNumero(ivaPct, 16)
  const diasValidade = lerNumero(validade, 10)
  const personalizacaoDe = (id: number) => (personalizacao[id] ?? 'Logo impresso').trim()

  // cada linha: preço por unidade (com IVA, se vai incluído) arredondado a 2 casas, e o total = preço × unidades, para a tabela somar certo
  const fator = ivaIncluido ? 1 + iva / 100 : 1
  const numeroOuNaN = (t: string) => (t.trim() === '' ? NaN : Number(t.replace(/\s/g, '').replace(',', '.')))
  const rotulos = [
    ...itens
      .map((i) => {
        const e = edicoes[i.id] ?? {}
        return {
          id: i.id,
          nome: e.nome ?? i.nome,
          unidades: e.unidades !== undefined ? numeroOuNaN(e.unidades) : i.unidades,
          preco: e.preco !== undefined ? numeroOuNaN(e.preco) : i.preco,
        }
      }),
  ]
  const linhas = rotulos.map((i) => {
    const unidades = Number.isInteger(i.unidades) && i.unidades > 0 ? i.unidades : NaN
    const unitario = arredondar2(i.preco * fator)
    return {
      ...i,
      unidades,
      unitario: i.preco >= 0 ? unitario : NaN,
      total: arredondar2(unitario * unidades),
    }
  })
  const valido = linhas.length > 0 && linhas.every((l) => Number.isFinite(l.total))
  const somaLinhas = linhas.reduce((t, l) => t + (Number.isFinite(l.total) ? l.total : 0), 0)
  // no fim da cotação, sempre: subtotal (sem IVA), IVA e total da factura; com o IVA incluído nos preços, o subtotal e o IVA tiram-se do total
  const subtotal = ivaIncluido ? arredondar2(somaLinhas / (1 + iva / 100)) : somaLinhas
  const ivaValor = ivaIncluido ? arredondar2(somaLinhas - subtotal) : arredondar2(somaLinhas * (iva / 100))
  const totalAPagar = ivaIncluido ? somaLinhas : somaLinhas + ivaValor
  const nomeCliente = cliente.trim()

  // miniatura do produto no início de cada linha (só se o nome for igual ao de um produto do catálogo)
  const fotoDe = useFotosProdutos(linhas.map((i) => i.nome))

  // edição em linha: o preço que se escreve é o da tabela (com IVA, se vai incluído); guarda-se sem IVA, e enquanto se escreve mostra-se o texto tal como está
  const [foco, setFoco] = useState<{ id: number; texto: string } | null>(null)
  const mudarLinha = (id: number, campo: 'nome' | 'unidades' | 'preco', v: string) => setEdicoes((d) => ({ ...d, [id]: { ...d[id], [campo]: v } }))
  const mudarPreco = (id: number, texto: string) => {
    setFoco({ id, texto })
    const n = numeroOuNaN(texto)
    mudarLinha(id, 'preco', Number.isFinite(n) ? String(n / fator) : texto)
  }
  // um produto da calculadora remove-se da calculadora (é o mesmo «Remover» da lista de produtos)
  const eliminar = (id: number) => aoRemover?.(id)
  // «Adicionar produto»: grava a cotação e vai ao catálogo; ao adicionar lá um produto, o catálogo volta aqui (ver pedido.ts)
  const acrescentar = async () => {
    await gravar()
    try {
      sessionStorage.setItem(
        'vd-cotacao-retorno',
        JSON.stringify({
          url: window.location.pathname + window.location.search,
          ate: Date.now() + 30 * 60 * 1000,
        }),
      )
    } catch {
      /* sem armazenamento: não há regresso automático */
    }
    window.location.assign('/brindes')
  }
  const textoQtd = (id: number, n: number) => edicoes[id]?.unidades ?? (Number.isFinite(n) ? String(n) : '')

  function imprimir() {
    const doc = document.getElementById(ID_DOCUMENTO)
    if (!doc) return
    const janela = window.open('', '_blank', 'width=920,height=1200')
    if (!janela) {
      setAviso('O navegador bloqueou a janela da cotação: permita as janelas deste site e tente outra vez.')
      return
    }
    setAviso('')
    // a janela leva os mesmos estilos da página e só o documento (montada com o DOM, sem escrever HTML à mão)
    const d = janela.document
    d.title = `Cotação ${numero.trim() || `VD-${ano}`}${nomeCliente ? ` · ${nomeCliente}` : ''}`
    const base = d.createElement('base')
    base.href = `${window.location.origin}/`
    d.head.appendChild(base)
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => d.head.appendChild(d.importNode(n, true)))
    const folha = d.createElement('style')
    folha.textContent = `@page{size:A4;margin:12mm}html,body{background:#fff!important;margin:0;padding:0}#${ID_DOCUMENTO}{max-width:none!important;border:0!important;box-shadow:none!important;padding:0!important}`
    d.head.appendChild(folha)
    // os campos editáveis passam a texto e os controlos de edição (eliminar, acrescentar, ampliar a foto) não vão para a folha
    const copia = doc.cloneNode(true) as HTMLElement
    const originais = doc.querySelectorAll('input')
    copia.querySelectorAll('input').forEach((inp, k) => {
      const sp = document.createElement('span')
      sp.textContent = originais[k].value
      sp.style.display = 'block'
      sp.style.textAlign = getComputedStyle(originais[k]).textAlign
      inp.replaceWith(sp)
    })
    copia.querySelectorAll('[data-sem-imprimir]').forEach((n) => n.remove())
    d.body.appendChild(d.importNode(copia, true))
    // dá tempo aos estilos e à imagem de carregarem antes de abrir a impressão
    window.setTimeout(() => {
      janela.focus()
      janela.print()
    }, 700)
  }

  return (
    <div className={CARTAO}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={TITULO}>Cotação ao cliente</h2>
        <button
          type="button"
          onClick={imprimir}
          disabled={!valido}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Printer className="h-4 w-4" aria-hidden />
          Imprimir ou guardar em PDF
        </button>
      </div>
      {aviso && <p className="mt-2 text-sm font-semibold text-red-600">{aviso}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3 @xl:grid-cols-3">
        <CampoTexto id="cci-cot-cliente" rotulo="Cliente" valor={cliente} aoMudar={setCliente} exemplo="Nome da empresa" />
        <CampoTexto id="cci-cot-contacto" rotulo="Contacto" valor={contacto} aoMudar={setContacto} exemplo="Nome e telefone" />
        <CampoTexto id="cci-cot-numero" rotulo="Número da cotação" valor={numero} aoMudar={setNumero} exemplo={`VD-${ano}-001`} />
        <CampoTexto id="cci-cot-data" rotulo="Data da cotação" valor={data} aoMudar={setData} />
        <CampoTexto id="cci-cot-validade" rotulo="Validade (dias)" valor={validade} aoMudar={setValidade} tipo="number" />
        <CampoTexto id="cci-cot-prazo" rotulo="Prazo de entrega" valor={prazo} aoMudar={setPrazo} exemplo="Ex.: 15 dias úteis" />
        <div className="col-span-2 @xl:col-span-3">
          <CampoTexto id="cci-cot-pagamento" rotulo="Condições de pagamento" valor={pagamento} aoMudar={setPagamento} exemplo="Ex.: 50% com a encomenda e 50% na entrega" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <label htmlFor="cci-cot-iva-incl" className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
          <input id="cci-cot-iva-incl" type="checkbox" checked={ivaIncluido} onChange={(e) => setIvaIncluido(e.target.checked)} className="h-4 w-4 shrink-0 accent-red-600" />
          <span>Preços com o IVA incluído</span>
        </label>
        <div className="w-32">
          <CampoTexto id="cci-cot-iva" rotulo="Taxa do IVA (%)" valor={ivaPct} aoMudar={setIvaPct} tipo="number" />
        </div>
      </div>

      {/* a tabela da cotação edita-se no próprio documento, em linha; aqui só o aviso e o regresso aos produtos da calculadora */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className={NOTA}>Clique em «Editar» para alterar a tabela da cotação (nome, personalização, quantidade e preço); o nome, a quantidade e o preço valem só para esta cotação; «Remover» tira o produto também da lista da calculadora.</p>
        {editar ? (
          <button
            type="button"
            onClick={() => {
              void gravar()
              setEditar(false)
            }}
            className="cursor-pointer rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Gravar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditar(true)}
            className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-red-500 hover:text-red-600 dark:border-slate-700 dark:text-slate-300"
          >
            Editar
          </button>
        )}
        {editar && Object.keys(edicoes).length > 0 && (
          <button
            type="button"
            onClick={() => {
              setEdicoes({})
            }}
            className="cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold text-slate-600 underline-offset-2 hover:text-red-600 hover:underline dark:text-slate-300"
          >
            Repor os produtos da calculadora
          </button>
        )}
      </div>

      {!valido ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <p className={NOTA}>A cotação aparece aqui quando os produtos e os custos acima estiverem todos preenchidos.</p>
          {editar && (
            <button
              type="button"
              onClick={acrescentar}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-red-500 hover:text-red-600 dark:border-slate-700 dark:text-slate-300"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Adicionar produto
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl bg-slate-100 p-3 dark:bg-slate-800 @xl:p-5">
          {/* o documento (sempre claro, como a folha impressa); é o que a janela de impressão leva */}
          <div id={ID_DOCUMENTO} className="mx-auto w-full min-w-[640px] max-w-[820px] bg-white p-8 text-[13px] leading-snug text-zinc-800 shadow-sm" style={{ fontFamily: 'Inter, Arial, Helvetica, sans-serif' }}>
            <div className="flex items-start justify-between gap-6 pb-4" style={{ borderBottom: `3px solid ${VERMELHO}` }}>
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/Logo - horizontal.jpg" alt="VisualDesign" className="h-14 w-auto object-contain object-left" />
                <p className="mt-1 text-[13px] text-zinc-600">Av: Karl Marx nº 177, Maputo — Moçambique</p>
              </div>
              <div className="text-right text-zinc-600">
                <p className="text-2xl font-extrabold tracking-wide text-zinc-900">COTAÇÃO</p>
                <p className="mt-1">
                  Nº {numero.trim() || `VD-${ano}-____`} · Data: {data}
                </p>
                <p>Validade: {diasValidade} dias a contar da entrega da cotação</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-zinc-100 px-4 py-3">
              <p className="text-zinc-600">Cliente</p>
              <p className="text-xl font-extrabold text-zinc-900">{nomeCliente || '[NOME DO CLIENTE]'}</p>
              <p className="text-zinc-600">Contacto: {contacto.trim() || '[NOME E TELEFONE]'}</p>
            </div>

            <table className="mt-5 w-full border-collapse text-left">
              <thead>
                <tr style={{ backgroundColor: VERMELHO }} className="text-white">
                  <th className="px-3 py-2 font-bold">Produto</th>
                  <th className="px-3 py-2 font-bold">Personalização</th>
                  <th className="px-3 py-2 text-right font-bold">Qtd</th>
                  <th className="px-3 py-2 text-right font-bold">{`Preço un. (${moeda})`}</th>
                  <th className="px-3 py-2 text-right font-bold">{`Total (${moeda})`}</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, k) => (
                  // linhas intercaladas com fundo cinzento claro (também na folha impressa)
                  <tr key={l.id} className="border-b border-zinc-200 align-middle" style={k % 2 === 1 ? { backgroundColor: '#f4f4f5', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } : undefined}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        {fotoDe(l.nome) && <Miniatura src={fotoDe(l.nome)} />}
                        {editar ? (
                          <input type="text" aria-label="Produto" value={l.nome} onChange={(e) => mudarLinha(l.id, 'nome', e.target.value)} className={`${EDITAR} text-[11px] leading-tight`} />
                        ) : (
                          <span className="text-[11px] leading-tight">{l.nome}</span>
                        )}
                        {editar && aoRemover && itens.length > 1 && (
                          <button type="button" data-sem-imprimir onClick={() => eliminar(l.id)} className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            Remover
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {editar ? (
                        <input
                          type="text"
                          aria-label="Personalização"
                          value={personalizacao[l.id] ?? 'Logo impresso'}
                          onChange={(e) =>
                            setPersonalizacao((p) => ({
                              ...p,
                              [l.id]: e.target.value,
                            }))
                          }
                          className={EDITAR}
                        />
                      ) : (
                        personalizacaoDe(l.id)
                      )}
                    </td>
                    <td className="w-20 px-3 py-2">
                      {editar ? (
                        <input type="text" inputMode="numeric" aria-label="Quantidade" value={textoQtd(l.id, l.unidades)} onChange={(e) => mudarLinha(l.id, 'unidades', e.target.value)} className={`${EDITAR} text-right tabular-nums`} />
                      ) : (
                        <span className="block text-right tabular-nums">{Number.isFinite(l.unidades) ? l.unidades : '–'}</span>
                      )}
                    </td>
                    <td className="w-28 px-3 py-2">
                      {editar ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label="Preço unitário"
                          value={foco?.id === l.id ? foco.texto : Number.isFinite(l.unitario) ? valor2(l.unitario) : ''}
                          onChange={(e) => mudarPreco(l.id, e.target.value)}
                          onBlur={() => setFoco(null)}
                          className={`${EDITAR} text-right tabular-nums`}
                        />
                      ) : (
                        <span className="block text-right tabular-nums">{Number.isFinite(l.unitario) ? valor2(l.unitario) : '–'}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{valor2(l.total)}</td>
                  </tr>
                ))}
                {editar && (
                  <tr data-sem-imprimir>
                    <td colSpan={5} className="px-3 py-2">
                      <button
                        type="button"
                        onClick={acrescentar}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-red-500 hover:text-red-600"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        Adicionar produto
                      </button>
                    </td>
                  </tr>
                )}
                <tr className="border-b border-zinc-200">
                  <td colSpan={4} className="px-3 py-2 text-right font-semibold">
                    Subtotal (sem IVA)
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{valor2(subtotal)}</td>
                </tr>
                <tr className="border-b border-zinc-200">
                  <td colSpan={4} className="px-3 py-2 text-right font-semibold">
                    IVA ({iva}%)
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{valor2(ivaValor)}</td>
                </tr>
                <tr className="border-b border-zinc-200">
                  <td colSpan={4} className="px-3 py-3 text-right text-[15px] font-extrabold text-zinc-900">
                    TOTAL DA FACTURA
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-[15px] font-extrabold tabular-nums" style={{ color: VERMELHO }}>
                    {valor2(totalAPagar)}
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="mt-4 text-zinc-600">
              {ivaIncluido ? `Preços por unidade com logo, transporte até Maputo e IVA de ${iva}% incluídos.` : 'Preços por unidade com logo e transporte até Maputo, sem IVA.'} Prazo de entrega: {prazo.trim() || '[PRAZO]'}. Pagamento:{' '}
              {pagamento.trim() || '[CONDIÇÕES DE PAGAMENTO]'}.
            </p>

            <div className="mt-5 rounded-xl p-4" style={{ border: `2px solid ${VERMELHO}` }}>
              <p className="text-lg font-extrabold text-zinc-900">Aprovação do cliente</p>
              <p className="mt-1 text-zinc-600">Ao assinar, {nomeCliente || 'o cliente'} aprova o design (posição e cores do logo), os modelos escolhidos e esta cotação.</p>
              <div className="mt-8 grid grid-cols-4 gap-4 text-zinc-600">
                {['Nome', 'Cargo', 'Assinatura e carimbo', 'Data'].map((t) => (
                  <div key={t} className="border-t border-zinc-800 pt-1">
                    {t}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-start justify-between gap-4 border-t border-zinc-300 pt-3 text-zinc-600">
              <span>VisualDesign · visualdesignmoz.com</span>
              <span className="text-right">
                WhatsApp: +258 82 52 88 318 · Mobile: +258 83 44 70 073
                <br />
                vendas@visualdesignmoz.com
              </span>
            </div>
          </div>
        </div>
      )}
      <p className={`${NOTA} mt-3`}>Os preços da cotação são os preços de venda calculados acima (o custo por unidade com a margem bruta pretendida). O IVA da venda soma-se por cima, à taxa que indicar.</p>
    </div>
  )
}
