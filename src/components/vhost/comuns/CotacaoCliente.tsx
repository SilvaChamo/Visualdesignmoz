'use client'

// Cotação ao cliente, no fim das tabelas da calculadora de custo de importação. Usa o preço de venda de cada produto
// (o custo por unidade já com a margem bruta pretendida) e monta o documento igual às cotações da VisualDesign
// (cabeçalho, caixa do cliente, tabela, total a pagar, aprovação do cliente e rodapé). Os campos do cliente, do prazo e
// do pagamento escrevem-se aqui; «Imprimir ou guardar em PDF» (por cima da folha) imprime só o documento, sem janela nova.

import { useContext, useEffect, useRef, useState } from 'react'
import { Mail, MessageCircle, Plus, Printer, Trash2 } from 'lucide-react'
import { VHContext } from '../context'
import { gravarEstado, lerEstado } from './estado-calculadora'
import { Miniatura, SeletorSemelhantes, useFotosProdutos } from './fotos-produtos'

export interface ItemCotacao {
  id: number
  nome: string
  unidades: number
  /** preço de venda por unidade, sem IVA (o custo por unidade com a margem bruta) */
  preco: number
}

// as peças de interface são as da calculadora (copiadas, para não haver importações a andar em círculo)
const CAMPO =
  'w-full rounded-[5px] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
const ROTULO = 'mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400'
const CARTAO = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 @xl:p-6'
const TITULO = 'text-lg font-bold text-slate-900 dark:text-slate-100'
const NOTA = 'text-xs leading-relaxed text-slate-500 dark:text-slate-400'
const VERMELHO = '#b00020'

const ID_DOCUMENTO = 'cci-cotacao-documento'
const ID_QUADRO = 'cci-cotacao-impressao'
// o que a cotação diz por omissão (prazo e pagamento); o campo pode mudar-se, e um campo vazio volta a isto
const PRAZO_PADRAO = '15 dias depois da adjudicação da factura'
const PAGAMENTO_PADRAO = '75% do valor da encomenda'

// a folha da cotação como página solta: os campos passam a texto e os controlos de edição saem
function copiaLimpa(doc: HTMLElement): HTMLElement {
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
  return copia
}
// a caixa de correio de onde sai a cotação (a mesma do rodapé do documento)
const CONTA_VENDAS = 'vendas@visualdesignmoz.com'
// campo de texto em linha dentro da tabela: parece texto até se passar o rato ou escrever
const EDITAR = 'w-full min-w-0 rounded-[5px] border border-transparent bg-transparent px-1 py-0.5 text-inherit outline-none transition hover:border-zinc-300 focus:border-red-500 focus:bg-white'

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

export function CotacaoCliente({ itens, moeda, aoRemover, aoTrocar, encomenda }: { itens: ItemCotacao[]; moeda: string; encomenda?: { batchId: string; cliente: string; contacto: string; numero: string }; aoRemover?: (id: number) => void; aoTrocar?: (id: number, sku: string) => Promise<void> }) {
  const [cliente, setCliente] = useState('')
  const [contacto, setContacto] = useState('')
  const [numero, setNumero] = useState('')
  const [data, setData] = useState('')
  const [validade, setValidade] = useState('10')
  const [prazo, setPrazo] = useState(PRAZO_PADRAO)
  const [pagamento, setPagamento] = useState(PAGAMENTO_PADRAO)
  const [ivaIncluido, setIvaIncluido] = useState(true)
  const [ivaPct, setIvaPct] = useState('16')
  const [personalizacao, setPersonalizacao] = useState<Record<number, string>>({})
  // a tabela da cotação edita-se aqui, sem mexer na calculadora: o que se escreve numa linha (nome, quantidade, preço) vale só para a cotação, as linhas
  // podem ser eliminadas e acrescentam-se outras; o que não se editou continua a seguir a calculadora
  const [edicoes, setEdicoes] = useState<Record<number, { nome?: string; unidades?: string; preco?: string }>>({})
  const [aviso, setAviso] = useState('')
  // a tabela só mostra os campos editáveis e o eliminar/adicionar quando se clica em «Editar»; «Gravar» guarda e volta à vista normal
  const [editar, setEditar] = useState(false)
  // título original da página enquanto o da cotação está posto para dar nome ao PDF
  const tituloPagina = useRef<string | null>(null)

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
        setPrazo(g.prazo || PRAZO_PADRAO)
        setPagamento(g.pagamento || PAGAMENTO_PADRAO)
        setIvaIncluido(g.ivaIncluido ?? true)
        setIvaPct(g.ivaPct ?? '16')
        setPersonalizacao(g.personalizacao ?? {})
        setEdicoes(g.edicoes ?? {})
      }
    })
  }, [])
  // ao carregar uma encomenda do site na calculadora, a cotação passa a ser a dela (empresa, responsável e número); ao abrir a página não se mexe no que está guardado
  const encomendaAnterior = useRef(encomenda?.batchId)
  useEffect(() => {
    if (!encomenda || encomenda.batchId === encomendaAnterior.current) return
    encomendaAnterior.current = encomenda.batchId
    setCliente(encomenda.cliente)
    setContacto(encomenda.contacto)
    setNumero(encomenda.numero)
    setEdicoes({})
  }, [encomenda])
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

  // com uma encomenda do site na calculadora, o cliente vê em Encomendas › Cotação só a cópia desta folha: cada alteração aqui actualiza-a (um instante depois, e nunca a meio de uma edição)
  const copiaChave = valido && !editar && encomenda ? JSON.stringify([encomenda.batchId, estado, itens]) : ''
  useEffect(() => {
    if (!copiaChave || !encomenda) return
    const t = window.setTimeout(() => {
      const doc = document.getElementById(ID_DOCUMENTO)
      if (!doc) return
      const copia = copiaLimpa(doc)
      copia.querySelectorAll('img').forEach((img) => {
        img.setAttribute('src', img.src)
        img.removeAttribute('srcset')
      })
      fetch(`/api/admin/cotacoes/${encomenda.batchId}/copia`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: copia.outerHTML }) }).catch(() => undefined)
    }, 1200)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copiaChave])

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
  // «Editar» (sem texto à volta) fica na própria cotação, a seguir ao botão de imprimir; «Gravar» guarda e volta à vista normal
  const botoesEditar = (
    <>
      {editar ? (
        <button
          type="button"
          onClick={() => {
            void gravar()
            setEditar(false)
          }}
          className="inline-flex cursor-pointer items-center rounded-[5px] bg-red-600 px-4 py-1.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
        >
          Gravar
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditar(true)}
          className="inline-flex cursor-pointer items-center rounded-[5px] border border-slate-300 bg-white px-4 py-1.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-red-500 hover:text-red-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        >
          Editar
        </button>
      )}
      {editar && Object.keys(edicoes).length > 0 && (
        <button type="button" onClick={() => setEdicoes({})} className="inline-flex cursor-pointer items-center rounded-[5px] border border-slate-300 bg-transparent px-4 py-1.5 text-sm font-bold text-slate-700 transition hover:border-red-500 hover:text-red-600 dark:border-slate-600 dark:text-slate-200">
          Repor os produtos da calculadora
        </button>
      )}
    </>
  )

  // partilhar a cotação: o e-mail abre o VhostMail com uma mensagem nova, já com a cotação em anexo (ficheiro que se abre no navegador e se imprime em PDF); o WhatsApp abre com o resumo escrito; nada se envia daqui
  const textoCotacao = () =>
    [
      `Cotação VisualDesign Nº ${numero.trim() || `VD-${ano}-____`}`,
      nomeCliente ? `Cliente: ${nomeCliente}` : '',
      '',
      ...linhas.map((l) => `- ${l.nome}: ${l.unidades} × ${valor2(l.unitario)} = ${valor2(l.total)} ${moeda}`),
      '',
      `Subtotal (sem IVA): ${valor2(subtotal)} ${moeda}`,
      `IVA (${iva}%): ${valor2(ivaValor)} ${moeda}`,
      `TOTAL DA FACTURA: ${valor2(totalAPagar)} ${moeda}`,
      `Validade: ${diasValidade} dias a contar da entrega da cotação`,
    ]
      .filter((l, k, a) => l !== '' || a[k - 1] !== '')
      .join('\n')
  const assuntoCotacao = `Cotação VisualDesign Nº ${numero.trim() || `VD-${ano}-____`}`
  const vh = useContext(VHContext)
  async function enviarPorEmail() {
    const doc = document.getElementById(ID_DOCUMENTO)
    // fora do painel não há VhostMail: abre o programa de e-mail do utilizador, como antes
    if (!doc || !vh) {
      window.location.href = `mailto:?subject=${encodeURIComponent(assuntoCotacao)}&body=${encodeURIComponent(textoCotacao())}`
      return
    }
    setAviso('')
    try {
      // a cotação vai como página única: campos passam a texto, controlos de edição saem, fotos vão dentro do ficheiro e os estilos da página também
      const copia = copiaLimpa(doc)
      await Promise.all(
        Array.from(copia.querySelectorAll('img')).map(async (img) => {
          const url = new URL(img.getAttribute('src') || '', window.location.href).href
          try {
            const blob = await (await fetch(url)).blob()
            img.src = await new Promise<string>((ok, falha) => {
              const l = new FileReader()
              l.onload = () => ok(String(l.result))
              l.onerror = () => falha(l.error)
              l.readAsDataURL(blob)
            })
          } catch {
            img.src = url
          }
          img.removeAttribute('srcset')
        }),
      )
      const css = Array.from(document.styleSheets)
        .map((f) => {
          try {
            return Array.from(f.cssRules)
              .map((r) => r.cssText)
              .join('\n')
          } catch {
            return ''
          }
        })
        .join('\n')
      const titulo = `Cotação ${numero.trim() || `VD-${ano}`}${nomeCliente ? ` · ${nomeCliente}` : ''}`
      const pagina = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${titulo.replace(/</g, '&lt;')}</title><style>${css}</style><style>@page{size:A4;margin:12mm}html,body{background:#fff!important;margin:0;padding:0}body *{visibility:visible!important}#${ID_DOCUMENTO}{width:auto!important;min-width:0!important;max-width:210mm;margin:0 auto!important;border:0!important;box-shadow:none!important}</style></head><body>${copia.outerHTML}</body></html>`
      const bytes = new TextEncoder().encode(pagina)
      let bin = ''
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      const nome = `Cotacao-${(numero.trim() || `VD-${ano}`).replace(/[^\w.-]+/g, '-')}.html`
      sessionStorage.setItem('vd-vhostmail-novo', JSON.stringify({ assunto: assuntoCotacao, texto: `${textoCotacao()}\n\nA cotação completa segue em anexo.`, anexo: { nome, tipo: 'text/html', b64: btoa(bin) } }))
      vh.nav('/utilizador/email/vhostmail/entrada/' + encodeURIComponent(CONTA_VENDAS))
    } catch {
      setAviso('Não foi possível preparar a cotação para o e-mail.')
    }
  }
  const botaoPartilha = 'inline-flex cursor-pointer items-center gap-1.5 rounded-[5px] border border-slate-300 bg-white px-4 py-1.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-red-500 hover:text-red-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
  const partilhar = (
    <>
      <button type="button" onClick={enviarPorEmail} className={botaoPartilha}>
        <Mail className="h-4 w-4" aria-hidden />
        E-mail
      </button>
      <button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(textoCotacao())}`, '_blank', 'noopener')} className={botaoPartilha}>
        <MessageCircle className="h-4 w-4" aria-hidden />
        WhatsApp
      </button>
    </>
  )

  const textoQtd = (id: number, n: number) => edicoes[id]?.unidades ?? (Number.isFinite(n) ? String(n) : '')

  async function imprimir() {
    const doc = document.getElementById(ID_DOCUMENTO)
    if (!doc) return
    setAviso('')
    // a folha imprime-se num quadro escondido da própria página: sem janela nova, só a caixa de impressão
    document.getElementById(ID_QUADRO)?.remove()
    const quadro = document.createElement('iframe')
    quadro.id = ID_QUADRO
    quadro.setAttribute('aria-hidden', 'true')
    quadro.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    quadro.srcdoc = '<!doctype html><meta charset="utf-8">'
    const aberto = new Promise<void>((ok) => {
      quadro.onload = () => ok()
    })
    document.body.appendChild(quadro)
    await aberto
    const janela = quadro.contentWindow!
    const d = quadro.contentDocument!
    // o quadro leva os mesmos estilos da página e só o documento (montado com o DOM, sem escrever HTML à mão)
    const titulo = `Cotação ${numero.trim() || `VD-${ano}`}${nomeCliente ? ` · ${nomeCliente}` : ''}`
    d.title = titulo
    const base = d.createElement('base')
    base.href = `${window.location.origin}/`
    d.head.appendChild(base)
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => d.head.appendChild(d.importNode(n, true)))
    const folha = d.createElement('style')
    // o CSS global de impressão (globals.css) esconde tudo menos #quote-print-area: aqui o documento tem de ficar visível; a folha usa a largura da página A4 menos as margens
    folha.textContent = `@page{size:A4;margin:12mm}html,body{background:#fff!important;margin:0;padding:0}body *{visibility:visible!important}#${ID_DOCUMENTO}{width:auto!important;min-width:0!important;max-width:none!important;border:0!important;box-shadow:none!important;padding:0!important}`
    d.head.appendChild(folha)
    // os campos editáveis passam a texto e os controlos de edição (eliminar, acrescentar) não vão para a folha
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
    // espera pelos estilos e pelas imagens antes de abrir a impressão (no máximo 4 s)
    const prontos = [
      ...Array.from(d.querySelectorAll('link[rel="stylesheet"]')).map(
        (l) =>
          new Promise<void>((ok) => {
            l.addEventListener('load', () => ok())
            l.addEventListener('error', () => ok())
          }),
      ),
      ...Array.from(d.images).map((i) => i.decode().catch(() => undefined)),
    ]
    await Promise.race([Promise.all(prontos), new Promise((ok) => window.setTimeout(ok, 4000))])
    // o nome do PDF guardado é o título da página que manda imprimir: põe-se o da cotação e repõe-se depois
    if (tituloPagina.current === null) tituloPagina.current = document.title
    document.title = titulo
    const repor = () => {
      if (tituloPagina.current !== null) document.title = tituloPagina.current
      tituloPagina.current = null
      quadro.remove()
    }
    janela.addEventListener('afterprint', repor, { once: true })
    window.addEventListener('afterprint', repor, { once: true })
    janela.focus()
    janela.print()
  }

  return (
    <div className={CARTAO}>
      <h2 className={TITULO}>Cotação ao cliente</h2>
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

      <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="w-20">
          <CampoTexto id="cci-cot-iva" rotulo="Taxa do IVA (%)" valor={ivaPct} aoMudar={setIvaPct} tipo="number" />
        </div>
        <label htmlFor="cci-cot-iva-incl" className="flex cursor-pointer items-center gap-2.5 pb-2 text-sm text-slate-700 dark:text-slate-300">
          <input id="cci-cot-iva-incl" type="checkbox" checked={ivaIncluido} onChange={(e) => setIvaIncluido(e.target.checked)} className="h-4 w-4 shrink-0 accent-red-600" />
          <span>Preços com o IVA incluído</span>
        </label>
      </div>

      {!valido ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <p className={NOTA}>A cotação aparece aqui quando os produtos e os custos acima estiverem todos preenchidos.</p>
          {botoesEditar}
          {editar && (
            <button
              type="button"
              onClick={acrescentar}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-[5px] border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-red-500 hover:text-red-600 dark:border-slate-700 dark:text-slate-300"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Adicionar produto
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 rounded-xl bg-slate-100 p-3 dark:bg-slate-800 @xl:p-5">
          {/* o botão fica na própria cotação, por cima da folha */}
          <div className="mx-auto mb-3 flex w-[210mm] max-w-full flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void imprimir()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-[5px] bg-red-600 px-4 py-1.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
            >
              <Printer className="h-4 w-4" aria-hidden />
              Imprimir ou guardar em PDF
            </button>
            {botoesEditar}
          </div>
          <div className="overflow-x-auto">
            {/* o documento (sempre claro, folha A4 com a margem de 12 mm da impressão); é o que se imprime */}
            <div id={ID_DOCUMENTO} className="mx-auto w-[210mm] shrink-0 bg-white p-[12mm] text-[13px] leading-snug text-zinc-800 shadow-sm" style={{ fontFamily: 'Inter, Arial, Helvetica, sans-serif' }}>
              <div className="flex items-start justify-between gap-6 pb-3">
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assets/Logo - horizontal.jpg" alt="VisualDesign" className="h-14 w-auto object-contain object-left" />
                </div>
                <div className="text-right text-zinc-600">
                  <p className="text-2xl font-extrabold tracking-wide text-zinc-900">COTAÇÃO</p>
                  <p className="mt-1">
                    Nº {numero.trim() || `VD-${ano}-____`} · Data: {data}
                  </p>
                  <p>Validade: {diasValidade} dias a contar da entrega da cotação</p>
                </div>
              </div>
              {/* a linha vermelha que separa o cabeçalho do corpo: em cima do lado do logo, desce em degrau a 45° para baixo do lado dos detalhes */}
              <div
                aria-hidden
                style={{
                  height: 12,
                  backgroundColor: VERMELHO,
                  clipPath: 'polygon(0 0, 38% 0, calc(38% + 11px) 11px, 100% 11px, 100% 12px, calc(38% + 10.59px) 12px, calc(38% - 0.41px) 1px, 0 1px)',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact',
                }}
              />

              {/* a caixa cinzenta segue o degrau da linha vermelha: mesmos 45°, a 14 px de distância medidos na perpendicular em todo o percurso */}
              <div
                className="rounded-[5px] bg-zinc-100 px-4 py-3"
                style={{
                  marginTop: 3,
                  clipPath: 'polygon(0 0, calc(38% - 6.21px) 0, calc(38% + 4.79px) 11px, 100% 11px, 100% 100%, 0 100%)',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact',
                }}
              >
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
                    <th className="whitespace-nowrap px-3 py-2 text-right font-bold">{`P.un. (${moeda})`}</th>
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
                          {editar && aoTrocar && (
                            <SeletorSemelhantes
                              nome={l.nome}
                              aoEscolher={async (sku) => {
                                await aoTrocar(l.id, sku)
                                // a troca dá o nome e o preço do produto novo: largam-se as edições anteriores destes dois campos
                                setEdicoes((d) => {
                                  const { nome, preco, ...resto } = d[l.id] ?? {}
                                  void nome
                                  void preco
                                  return { ...d, [l.id]: resto }
                                })
                              }}
                            />
                          )}
                          {editar && aoRemover && itens.length > 1 && (
                            <button type="button" data-sem-imprimir onClick={() => eliminar(l.id)} className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[5px] px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50">
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
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-[5px] border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-red-500 hover:text-red-600"
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
          <div className="mx-auto mt-3 flex w-[210mm] max-w-full flex-wrap items-center justify-end gap-2">{partilhar}</div>
        </div>
      )}
      <p className={`${NOTA} mt-3`}>Os preços da cotação são os preços de venda calculados acima (o custo por unidade com a margem bruta pretendida). O IVA da venda soma-se por cima, à taxa que indicar.</p>
    </div>
  )
}
