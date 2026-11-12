'use client'

// Cotação ao cliente, no fim das tabelas da calculadora de custo de importação. Usa o preço de venda de cada produto
// (o custo por unidade já com a margem bruta pretendida) e monta o documento igual às cotações da VisualDesign
// (cabeçalho, caixa do cliente, tabela, total a pagar, aprovação do cliente e rodapé). Os campos do cliente, do prazo e
// do pagamento escrevem-se aqui; «Imprimir ou guardar em PDF» abre o documento sozinho numa janela, pronto a imprimir.

import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'

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

export function CotacaoCliente({ itens, moeda }: { itens: ItemCotacao[]; moeda: string }) {
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
  const [aviso, setAviso] = useState('')

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
  const linhas = itens.map((i) => {
    const unitario = arredondar2(i.preco * fator)
    return { ...i, unitario, total: arredondar2(unitario * i.unidades) }
  })
  const valido = linhas.length > 0 && linhas.every((l) => Number.isFinite(l.total))
  const somaLinhas = linhas.reduce((t, l) => t + (Number.isFinite(l.total) ? l.total : 0), 0)
  const ivaValor = arredondar2(somaLinhas * (iva / 100))
  const totalAPagar = ivaIncluido ? somaLinhas : somaLinhas + ivaValor
  const nomeCliente = cliente.trim()

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
    d.body.appendChild(d.importNode(doc, true))
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

      {linhas.length > 0 && (
        <>
          <p className={`${ROTULO} mb-2 mt-5`}>Personalização de cada produto</p>
          <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
            {linhas.map((l) => (
              <div key={l.id}>
                <label htmlFor={`cci-cot-pers-${l.id}`} className="mb-1 block truncate text-xs text-slate-500 dark:text-slate-400" title={l.nome}>
                  {l.nome}
                </label>
                <input
                  id={`cci-cot-pers-${l.id}`}
                  type="text"
                  value={personalizacao[l.id] ?? 'Logo impresso'}
                  onChange={(e) => setPersonalizacao((p) => ({ ...p, [l.id]: e.target.value }))}
                  className={CAMPO}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {!valido ? (
        <p className={`${NOTA} mt-5`}>A cotação aparece aqui quando os produtos e os custos acima estiverem todos preenchidos.</p>
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
                {linhas.map((l) => (
                  <tr key={l.id} className="border-b border-zinc-200">
                    <td className="px-3 py-2.5">{l.nome}</td>
                    <td className="px-3 py-2.5">{personalizacaoDe(l.id)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{l.unidades}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{valor2(l.unitario)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{valor2(l.total)}</td>
                  </tr>
                ))}
                {!ivaIncluido && (
                  <>
                    <tr className="border-b border-zinc-200">
                      <td colSpan={4} className="px-3 py-2 text-right font-semibold">
                        Total sem IVA
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{valor2(somaLinhas)}</td>
                    </tr>
                    <tr className="border-b border-zinc-200">
                      <td colSpan={4} className="px-3 py-2 text-right font-semibold">
                        IVA ({iva}%)
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{valor2(ivaValor)}</td>
                    </tr>
                  </>
                )}
                <tr className="border-b border-zinc-200">
                  <td colSpan={4} className="px-3 py-3 text-right text-[15px] font-extrabold text-zinc-900">
                    {ivaIncluido ? `TOTAL A PAGAR (IVA ${iva}% e transporte incluídos)` : 'TOTAL A PAGAR'}
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
      <p className={`${NOTA} mt-3`}>
        Os preços da cotação são os preços de venda calculados acima (o custo por unidade com a margem bruta pretendida). O IVA da venda soma-se por cima, à taxa que indicar.
      </p>
    </div>
  )
}
