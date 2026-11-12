// Calculadora de custo de importação (custo "posto no armazém", em inglês "landed cost").
//
// Função pura, sem texto para o utilizador: devolve números e códigos de erro; a página (componente) é que os escreve
// em português e o dicionário (src/lib/i18n-textos.ts) dá a versão inglesa.
//
// Como se calcula (por linha de produto, e a soma das linhas é o total da remessa):
//   mercadorias        = unidades × custo unitário (FOB)
//   valor aduaneiro    = mercadorias (+ frete se CFR/CIF) (+ seguro se CIF)
//   direitos           = valor aduaneiro × taxa de direitos da linha
//   taxas de entrada   = (EUA) MPF e HMF sobre o valor aduaneiro total, repartidas pelo valor aduaneiro de cada linha
//   imposto de entrada = (IVA/GST) base × taxa; entra no custo só se não for recuperável
//   partilhados        = corretor + porto + entrega interna + entrega ao domicílio + outros, repartidos pelo método escolhido
//   comissão           = valor total da comissão (em dinheiro), repartido pelo valor de cada linha; entra nos partilhados
//   custo posto        = mercadorias + frete + seguro + direitos + taxas/imposto + partilhados
//   custo por unidade  = custo posto ÷ unidades que se conseguem vender
//   preço com margem   = custo por unidade ÷ (1 − margem)
// O frete segue o método de repartição (valor, peso ou volume); o seguro e as taxas dos EUA seguem sempre o valor.

export type ModoImposto = 'iva' | 'eua'
export type Reparticao = 'valor' | 'peso' | 'volume'
export type BaseAduaneira = 'fob' | 'cfr' | 'cif'
export type TipoEntradaEua = 'formal' | 'informal' | 'nenhuma'

export interface LinhaEntrada {
  nome: string
  unidades: number
  /** custo unitário FOB */
  custo: number
  /** taxa de direitos aduaneiros, em % */
  direitos: number
  peso: number
  volume: number
}

export interface EntradaCalculo {
  modo: ModoImposto
  reparticao: Reparticao
  base: BaseAduaneira
  linhas: LinhaEntrada[]
  frete: number
  seguro: number
  corretor: number
  porto: number
  entrega: number
  /** entrega ao domicílio (do armazém ao cliente) */
  entregaDomicilio: number
  outros: number
  /** comissão total (valor, não percentagem), repartida pelo valor de cada linha */
  comissao: number
  /** unidades que não se vendem, em % */
  perdasPct: number
  /** margem bruta pretendida, em % */
  margemPct: number
  // EUA
  entrada: TipoEntradaEua
  mpfPct: number
  mpfMin: number
  mpfMax: number
  mpfFixo: number
  hmfPct: number
  maritimo: boolean
  // IVA ou GST
  impostoPct: number
  impostoSobreDireitos: boolean
  impostoSobreFrete: boolean
  recuperavel: boolean
}

export type CodigoErro =
  | 'sem-linhas'
  | 'campos-remessa'
  | 'perdas'
  | 'margem'
  | 'unidades'
  | 'campos-linha'
  | 'custo-zero'
  | 'sem-peso'
  | 'sem-volume'
  | 'sem-vendaveis'

export interface LinhaResultado {
  nome: string
  unidades: number
  vendaveis: number
  mercadorias: number
  /** parte do valor (0–1) */
  parteValor: number
  /** parte pelo método de repartição escolhido (0–1) */
  parte: number
  frete: number
  seguro: number
  valorAduaneiro: number
  direitos: number
  /** parte do MPF + HMF */
  taxas: number
  baseImposto: number
  imposto: number
  /** o imposto que entra no custo (zero se for recuperável) */
  impostoNoCusto: number
  partilhados: number
  /** a parte da comissão (já está dentro dos partilhados) */
  comissao: number
  total: number
  porUnidade: number
  preco: number
}

export type MpfLimite = '' | 'min' | 'max' | 'fixo'

export type ResultadoCalculo =
  | { ok: false; erro: CodigoErro }
  | {
      ok: true
      linhas: LinhaResultado[]
      mercadorias: number
      valorAduaneiro: number
      frete: number
      seguro: number
      direitos: number
      mpf: number
      mpfLimite: MpfLimite
      hmf: number
      baseImposto: number
      imposto: number
      recuperavel: boolean
      corretor: number
      porto: number
      entrega: number
      entregaDomicilio: number
      outros: number
      /** comissão total (já está dentro dos partilhados) */
      comissao: number
      partilhados: number
      total: number
      /** a pagar à alfândega à entrada: direitos + taxas + imposto (mesmo o recuperável, que é dinheiro à saída) */
      aPagarNaEntrada: number
      unidades: number
      vendaveis: number
      /** quanto o total fica acima das mercadorias, em % */
      acima: number
      freteNoValor: boolean
      seguroNoValor: boolean
    }

const finito = (n: number) => Number.isFinite(n) && n >= 0

export function calcularCustoImportacao(e: EntradaCalculo): ResultadoCalculo {
  const eua = e.modo === 'eua'
  const linhas = e.linhas
  if (!linhas.length) return { ok: false, erro: 'sem-linhas' }

  const campos = [e.frete, e.seguro, e.corretor, e.porto, e.entrega, e.entregaDomicilio, e.outros, e.comissao, e.perdasPct, e.margemPct]
  if (eua) campos.push(e.mpfPct, e.mpfMin, e.mpfMax, e.mpfFixo, e.hmfPct)
  else campos.push(e.impostoPct)
  if (!campos.every(finito)) return { ok: false, erro: 'campos-remessa' }
  if (e.perdasPct >= 100) return { ok: false, erro: 'perdas' }
  if (e.margemPct >= 100) return { ok: false, erro: 'margem' }

  let G = 0 // mercadorias
  let P = 0 // peso
  let V = 0 // volume
  for (const l of linhas) {
    if (!(l.unidades > 0 && Math.floor(l.unidades) === l.unidades)) return { ok: false, erro: 'unidades' }
    if (![l.custo, l.direitos, l.peso, l.volume].every(finito)) return { ok: false, erro: 'campos-linha' }
    G += l.unidades * l.custo
    P += l.unidades * l.peso
    V += l.unidades * l.volume
  }
  if (!(G > 0)) return { ok: false, erro: 'custo-zero' }
  if (e.reparticao === 'peso' && !(P > 0)) return { ok: false, erro: 'sem-peso' }
  if (e.reparticao === 'volume' && !(V > 0)) return { ok: false, erro: 'sem-volume' }

  const freteNoValor = e.base === 'cfr' || e.base === 'cif'
  const seguroNoValor = e.base === 'cif'
  const partilhadosTotal = e.corretor + e.porto + e.entrega + e.entregaDomicilio + e.outros

  // 1.ª passagem: mercadorias, repartições, valor aduaneiro e direitos de cada linha
  let VA = 0
  const base = linhas.map((l) => {
    const mercadorias = l.unidades * l.custo
    const parteValor = mercadorias / G
    const parte = e.reparticao === 'peso' ? (l.unidades * l.peso) / P : e.reparticao === 'volume' ? (l.unidades * l.volume) / V : parteValor
    const frete = e.frete * parte
    const seguro = e.seguro * parteValor
    const valorAduaneiro = mercadorias + (freteNoValor ? frete : 0) + (seguroNoValor ? seguro : 0)
    VA += valorAduaneiro
    return { l, mercadorias, parteValor, parte, frete, seguro, valorAduaneiro, direitos: (valorAduaneiro * l.direitos) / 100 }
  })

  // taxas de entrada dos EUA, sobre o valor aduaneiro total
  let mpf = 0
  let mpfLimite: MpfLimite = ''
  let hmf = 0
  if (eua) {
    if (e.entrada === 'formal') {
      mpf = (VA * e.mpfPct) / 100
      if (mpf < e.mpfMin) {
        mpf = e.mpfMin
        mpfLimite = 'min'
      }
      if (e.mpfMax > 0 && mpf > e.mpfMax) {
        mpf = e.mpfMax
        mpfLimite = 'max'
      }
    } else if (e.entrada === 'informal') {
      mpf = e.mpfFixo
      mpfLimite = 'fixo'
    }
    hmf = e.maritimo ? (VA * e.hmfPct) / 100 : 0
  }

  // 2.ª passagem: taxas, imposto, partilhados, total e custo por unidade
  const T = { mercadorias: 0, frete: 0, seguro: 0, direitos: 0, taxas: 0, baseImposto: 0, imposto: 0, partilhados: 0, total: 0, unidades: 0, vendaveis: 0 }
  const saida: LinhaResultado[] = []
  for (const b of base) {
    const taxas = ((mpf + hmf) * b.valorAduaneiro) / VA
    const baseImposto = eua
      ? 0
      : b.valorAduaneiro +
        (e.impostoSobreDireitos ? b.direitos : 0) +
        (e.impostoSobreFrete ? (freteNoValor ? 0 : b.frete) + (seguroNoValor ? 0 : b.seguro) : 0)
    const imposto = eua ? 0 : (baseImposto * e.impostoPct) / 100
    const impostoNoCusto = e.recuperavel && !eua ? 0 : imposto
    const comissao = e.comissao * b.parteValor
    const partilhados = partilhadosTotal * b.parte + comissao
    const total = b.mercadorias + b.frete + b.seguro + b.direitos + taxas + impostoNoCusto + partilhados
    // as unidades perdidas arredondam-se para cima, linha a linha
    const perdidas = Math.max(0, Math.ceil((b.l.unidades * e.perdasPct) / 100 - 1e-9))
    const vendaveis = b.l.unidades - perdidas
    if (!(vendaveis > 0)) return { ok: false, erro: 'sem-vendaveis' }
    const porUnidade = total / vendaveis
    saida.push({
      nome: b.l.nome,
      unidades: b.l.unidades,
      vendaveis,
      mercadorias: b.mercadorias,
      parteValor: b.parteValor,
      parte: b.parte,
      frete: b.frete,
      seguro: b.seguro,
      valorAduaneiro: b.valorAduaneiro,
      direitos: b.direitos,
      taxas,
      baseImposto,
      imposto,
      impostoNoCusto,
      partilhados,
      comissao,
      total,
      porUnidade,
      preco: porUnidade / (1 - e.margemPct / 100),
    })
    T.mercadorias += b.mercadorias
    T.frete += b.frete
    T.seguro += b.seguro
    T.direitos += b.direitos
    T.taxas += taxas
    T.baseImposto += baseImposto
    T.imposto += imposto
    T.partilhados += partilhados
    T.total += total
    T.unidades += b.l.unidades
    T.vendaveis += vendaveis
  }

  const recuperavel = e.recuperavel && !eua
  return {
    ok: true,
    linhas: saida,
    mercadorias: T.mercadorias,
    valorAduaneiro: VA,
    frete: T.frete,
    seguro: T.seguro,
    direitos: T.direitos,
    mpf,
    mpfLimite,
    hmf,
    baseImposto: T.baseImposto,
    imposto: T.imposto,
    recuperavel,
    corretor: e.corretor,
    porto: e.porto,
    entrega: e.entrega,
    entregaDomicilio: e.entregaDomicilio,
    outros: e.outros,
    comissao: e.comissao,
    partilhados: T.partilhados,
    total: T.total,
    aPagarNaEntrada: T.direitos + mpf + hmf + T.imposto,
    unidades: T.unidades,
    vendaveis: T.vendaveis,
    acima: (T.total / T.mercadorias - 1) * 100,
    freteNoValor,
    seguroNoValor,
  }
}

/** Valores de partida (o exemplo): duas linhas, remessa por mar, IVA de 16% como valor de exemplo (editável). */
export const EXEMPLO_LINHAS: LinhaEntrada[] = [
  { nome: 'Canecas de cerâmica', unidades: 2000, custo: 6, direitos: 10, peso: 0.9, volume: 0.06 },
  { nome: 'Sacos de algodão', unidades: 3000, custo: 1.5, direitos: 20, peso: 0.15, volume: 0.02 },
]

export const EXEMPLO_ENTRADA: Omit<EntradaCalculo, 'linhas'> = {
  modo: 'iva',
  reparticao: 'valor',
  base: 'cif',
  frete: 2100,
  seguro: 85,
  corretor: 150,
  porto: 240,
  entrega: 380,
  entregaDomicilio: 0,
  outros: 120,
  comissao: 0,
  perdasPct: 0,
  margemPct: 50,
  entrada: 'formal',
  // valores de referência da CBP (EUA) para o ano fiscal de 2027, editáveis
  mpfPct: 0.3464,
  mpfMin: 34.58,
  mpfMax: 670.86,
  mpfFixo: 2.77,
  hmfPct: 0.125,
  maritimo: true,
  impostoPct: 16,
  impostoSobreDireitos: true,
  impostoSobreFrete: true,
  recuperavel: false,
}
