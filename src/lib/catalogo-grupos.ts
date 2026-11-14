// Grupos e subcategorias do catálogo de brindes (VisualGifts): o menu do site e a página /brindes usam esta mesma lista.
//
// Só dados e regras puras, sem o ficheiro de produtos: pode ser importado por componentes 'use client' (o cabeçalho).
// O fornecedor só dá categorias de topo (ex.: «Apparel»); as subcategorias («Polos», «Canecas», …) vêm do nome do produto.
// Cada produto chega aqui como { n: nome sem acentos em minúsculas, c: id da categoria de topo }.

export interface ProdutoParaFiltro {
  n: string
  c: string
}

type Teste = (p: ProdutoParaFiltro) => boolean

export interface Sub {
  id: string
  nome: string
  teste: Teste
}

export interface Coluna {
  titulo: string
  subs: Sub[]
}

export interface Grupo {
  id: string
  nome: string
  colunas: Coluna[]
  /** o grupo inteiro («Ver tudo»): inclui o que não cabe em nenhuma subcategoria */
  todos: Teste
}

const nome = (re: RegExp): Teste => (p) => re.test(p.n)
const cat = (...ids: string[]): Teste => (p) => ids.includes(p.c)
const e = (...ts: Teste[]): Teste => (p) => ts.every((t) => t(p))
const ou = (...ts: Teste[]): Teste => (p) => ts.some((t) => t(p))
const nao = (t: Teste): Teste => (p) => !t(p)

// Material de segurança: qualquer categoria; sai dos uniformes e dos brindes
const ALTA_VISIBILIDADE = nome(/hi-?vi[sz]|reflective|high.?visib/)
const FATOS_DE_TRABALHO = nome(/overall|coverall|boiler ?suit|work ?suit|conti ?suit|dust ?coat|technician|food safety/)
const PROTECCAO = nome(/\bboots?\b|safety (shoe|sneaker|boot|glasses)|steel toe|helmet|hard ?hat|goggle|ear ?plug|respirator/)
// só vestuário: «Safety Box Cutter» ou «Hard Hat Stress Buster» são brindes, não material de segurança
const SEGURANCA = e(cat('apparel'), ou(ALTA_VISIBILIDADE, FATOS_DE_TRABALHO, PROTECCAO, nome(/\bsafety\b/)))

const MAIS_PRODUTOS_CATEGORIAS = ['bags', 'display', 'outdoor', 'sports-wellness', 'custom-products']

const naoSeguranca = nao(SEGURANCA)

const BRINDES: Grupo = {
  id: 'brindes',
  nome: 'Brindes',
  todos: e(nao(cat('apparel', ...MAIS_PRODUTOS_CATEGORIAS)), naoSeguranca),
  colunas: [
    {
      titulo: 'Copos e garrafas',
      subs: [
        { id: 'garrafas-de-agua', nome: 'Garrafas de água', teste: nome(/bottle/) },
        { id: 'canecas', nome: 'Canecas', teste: nome(/\bmug/) },
        { id: 'garrafas-termicas', nome: 'Garrafas e copos térmicos', teste: nome(/flask|tumbler|vacuum|thermal/) },
      ],
    },
    {
      titulo: 'Tecnologia',
      subs: [
        { id: 'power-banks', nome: 'Power banks e carregadores', teste: nome(/power ?bank|charger|charging/) },
        { id: 'pen-drives', nome: 'Pen drives', teste: nome(/flash drive|usb|memory stick/) },
      ],
    },
    {
      titulo: 'Escritório',
      subs: [
        { id: 'canetas', nome: 'Canetas', teste: nome(/\bpens?\b|stylus|pencil/) },
        { id: 'cadernos', nome: 'Cadernos e blocos', teste: nome(/notebook|notepad|journal|diary|jotter/) },
      ],
    },
    {
      titulo: 'Ocasiões',
      subs: [
        { id: 'executivos', nome: 'Brindes executivos', teste: cat('executive-gifts') },
        { id: 'boas-vindas', nome: 'Boas-vindas e kits', teste: cat('welcome-gifts') },
        { id: 'ecologicos', nome: 'Ecológicos', teste: cat('eco-friendly') },
      ],
    },
  ],
}

const UNIFORMES: Grupo = {
  id: 'uniformes',
  nome: 'Uniformes',
  todos: e(cat('apparel'), naoSeguranca),
  colunas: [
    {
      titulo: 'Parte de cima',
      subs: [
        { id: 'polos', nome: 'Polos', teste: e(nome(/golf shirt|polo/), naoSeguranca) },
        { id: 't-shirts', nome: 'T-shirts', teste: e(nome(/t-?shirt|\btee\b/), naoSeguranca) },
        { id: 'camisas', nome: 'Camisas', teste: e(nome(/\bshirt\b/), nao(nome(/golf|t-?shirt/)), naoSeguranca) },
      ],
    },
    {
      titulo: 'Casacos',
      subs: [
        { id: 'casacos', nome: 'Casacos e polares', teste: e(nome(/jacket|fleece|softshell|bodywarmer|hoodie|jersey|sweater|pullover|windbreaker|parka|coat|gilet/), naoSeguranca) },
      ],
    },
    {
      titulo: 'Acessórios',
      subs: [{ id: 'bones', nome: 'Bonés e acessórios', teste: e(nome(/\bcap\b|beanie|\bhat\b|visor|bucket|gloves?\b|scarf|\bbuff\b/), naoSeguranca) }],
    },
    {
      titulo: 'Parte de baixo',
      subs: [{ id: 'calcas', nome: 'Calças e calções', teste: e(nome(/\bpants?\b|trouser|shorts?\b|skirt|legging|jogger/), naoSeguranca) }],
    },
  ],
}

const SEGURANCA_GRUPO: Grupo = {
  id: 'seguranca',
  nome: 'Material de segurança',
  todos: SEGURANCA,
  colunas: [
    {
      titulo: 'Roupa de trabalho',
      subs: [
        { id: 'alta-visibilidade', nome: 'Alta visibilidade', teste: ALTA_VISIBILIDADE },
        { id: 'fatos-de-trabalho', nome: 'Fatos-macaco e fatos de trabalho', teste: FATOS_DE_TRABALHO },
      ],
    },
    {
      titulo: 'Protecção',
      subs: [{ id: 'proteccao', nome: 'Calçado e protecção', teste: PROTECCAO }],
    },
  ],
}

const MAIS_PRODUTOS: Grupo = {
  id: 'mais-produtos',
  nome: 'Mais produtos',
  todos: e(cat(...MAIS_PRODUTOS_CATEGORIAS), naoSeguranca),
  colunas: [
    {
      titulo: 'Malas e sacos',
      subs: [
        { id: 'mochilas', nome: 'Mochilas e malas para portátil', teste: e(cat('bags'), nome(/backpack|rucksack|laptop|daypack/)) },
        { id: 'sacos-de-conferencia', nome: 'Sacos e pastas de conferência', teste: e(cat('bags'), nome(/conference|folder|portfolio|satchel|briefcase|document/)) },
        { id: 'sacos-de-compras', nome: 'Sacos de compras', teste: e(cat('bags'), nome(/tote|shopper|shopping|drawstring/)) },
        { id: 'malas-de-viagem', nome: 'Malas de viagem e desporto', teste: e(cat('bags'), nome(/duffel|trolley|travel|sport/)) },
        { id: 'sacos-termicos', nome: 'Sacos térmicos', teste: e(cat('bags'), nome(/cooler|lunch/)) },
      ],
    },
    {
      titulo: 'Eventos',
      subs: [{ id: 'expositores', nome: 'Expositores e stands', teste: cat('display') }],
    },
    {
      titulo: 'Ar livre e bem-estar',
      subs: [
        { id: 'ar-livre', nome: 'Ar livre', teste: cat('outdoor') },
        { id: 'desporto', nome: 'Desporto e bem-estar', teste: cat('sports-wellness') },
      ],
    },
    {
      titulo: 'À medida',
      subs: [{ id: 'produtos-a-medida', nome: 'Produtos à medida', teste: cat('custom-products') }],
    },
  ],
}

export const GRUPOS: Grupo[] = [BRINDES, UNIFORMES, SEGURANCA_GRUPO, MAIS_PRODUTOS]

export const grupoPorId = (id: string | undefined) => GRUPOS.find((g) => g.id === id)

export const subPorId = (g: Grupo | undefined, id: string | undefined): Sub | undefined =>
  g?.colunas.flatMap((c) => c.subs).find((s) => s.id === id)

/** ligação de um grupo ou de uma subcategoria na página /brindes */
export const hrefGrupo = (g: Grupo, s?: Sub) => `/brindes?grupo=${g.id}${s ? `&sub=${s.id}` : ''}#catalogo`
