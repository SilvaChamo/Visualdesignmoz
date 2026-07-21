export type PriceItem = {
  name: string
  price: number
  // Sem preço fixo — mostrar "Sob Consulta" em vez de um valor calculado.
  sobConsulta?: boolean
}

export type Category = {
  id: string
  label: string
  subtitle: string
  minQty: string
  brand: string
  items: PriceItem[]
}

export type Brand = {
  id: string
  label: string
}

export const BRANDS: Brand[] = [
  { id: 'visualdesign', label: 'Design Gráfico' },
  { id: 'visualweb', label: 'Web Design' },
  { id: 'visualtransporte', label: 'Transporte' },
  { id: 'visualeventos', label: 'Eventos' },
  { id: 'visualgifts', label: 'Brindes Corporativos' },
  { id: 'visualpro', label: 'Produção Audiovisual' },
]

export const CATEGORIES: Category[] = [
  // ============================================
  // VisualDesign — design gráfico, impressão, produção
  // ============================================
  {
    id: 'cartoes',
    label: 'Cartões de Visita',
    subtitle: 'Cartões de visita em vários acabamentos.',
    minQty: 'Quantidade mínima: 50 unidades',
    brand: 'visualdesign',
    items: [
      { name: 'Cartolina 300g, Preto e Branco — 1 Face', price: 9.36 },
      { name: 'Cartolina 300g, Preto e Branco — Frente e Verso', price: 16.38 },
      { name: 'Cartolina 300g, Colorido — 1 Face', price: 12.87 },
      { name: 'Cartolina 300g, Colorido — Frente e Verso', price: 17.55 },
      { name: 'Laminado 120g, Colorido — 1 Face', price: 14.04 },
      { name: 'Laminado 120g, Colorido — Frente e Verso', price: 17.55 },
      { name: 'Papel Especial 300g, Colorido — 1 Face', price: 19.89 },
      { name: 'Papel Especial 300g, Colorido — Frente e Verso', price: 19.89 },
    ],
  },
  {
    id: 'flyers',
    label: 'Flyers & Panfletos',
    subtitle: 'Panfletos e folhetos em vários formatos.',
    minQty: 'Quantidade mínima: 50 unidades',
    brand: 'visualdesign',
    items: [
      { name: 'DL — 1 Face', price: 17.55 },
      { name: 'DL — 2 Faces', price: 20.48 },
      { name: 'DL — 2 Dobras, Frente e Verso', price: 70.20 },
      { name: 'DL — 3 Dobras, Frente e Verso', price: 81.90 },
      { name: 'A5 — 1 Face', price: 22.23 },
      { name: 'A5 — Frente e Verso', price: 30.42 },
      { name: 'A4 — 1 Face, Frente e Verso', price: 40.95 },
      { name: 'A4 — 2 Faces, Frente e Verso', price: 64.35 },
    ],
  },
  {
    id: 'blocos',
    label: 'Blocos de Factura & Recibo',
    subtitle: 'Blocos personalizados para a sua empresa.',
    minQty: 'Quantidade mínima: 5 blocos',
    brand: 'visualdesign',
    items: [
      { name: 'A5, Preto e Branco, Normal', price: 409.50 },
      { name: 'A5, Colorido, Normal', price: 491.40 },
      { name: 'A4, Preto e Branco, Normal', price: 561.60 },
      { name: 'A4, Colorido, Normal', price: 702 },
      { name: 'A5, Papel NSR, Triplicado', price: 702 },
      { name: 'A4, Papel NSR, Triplicado', price: 836.55 },
    ],
  },
  {
    id: 'papelaria',
    label: 'Papelaria Corporativa',
    subtitle: 'Papel timbrado para correspondência da empresa.',
    minQty: 'Quantidade mínima: 2 resmas',
    brand: 'visualdesign',
    items: [
      { name: 'Papel Timbrado (Resma)', price: 1872 },
      { name: 'Papel Timbrado com Fundo no Meio da Folha (Resma)', price: 2047.50 },
    ],
  },
  {
    id: 'publicidade',
    label: 'Publicidade Exterior',
    subtitle: 'Banners, autocolantes e anúncios.',
    minQty: 'Quantidade mínima: conforme o item',
    brand: 'visualdesign',
    items: [
      { name: 'Anúncio A4', price: 2574 },
      { name: 'Autocolante em Vinil / Metro Quadrado', price: 1111.50 },
      { name: 'Banner em Lona / Metro Quadrado', price: 936 },
      { name: 'RollUp Banner Simples (mín. 2)', price: 7605 },
      { name: 'RollUp Banner Executivo (mín. 2)', price: 7605 },
    ],
  },
  {
    id: 'texteis',
    label: 'Têxteis & Serigrafia',
    subtitle: 'Estampagem, bordados e fardamento personalizado.',
    minQty: 'Quantidade mínima: 20 unidades',
    brand: 'visualdesign',
    items: [
      { name: 'Estampagem', price: 140.40 },
      { name: 'Bordados', price: 152.10 },
      { name: 'Camisete Polo, Normal — Bordado', price: 432.90 },
      { name: 'Camisete Polo, Executiva — Bordado', price: 409.50 },
      { name: 'Camisete Simples — Estampada', price: 432.90 },
      { name: 'Camisete Polo — Estampada', price: 362.70 },
    ],
  },
  {
    id: 'design-identidade',
    label: 'Design Gráfico & Identidade Visual',
    subtitle: 'Logótipos, manuais de marca e estacionário corporativo.',
    minQty: '',
    brand: 'visualdesign',
    items: [
      { name: 'Criação de Logótipo & Manual de Normas', price: 0, sobConsulta: true },
      { name: 'Estacionário Corporativo (Cartões, Papel Timbrado)', price: 0, sobConsulta: true },
      { name: 'Design de Catálogos, Brochuras & Flyers', price: 0, sobConsulta: true },
    ],
  },
  {
    id: 'branding-estrategia',
    label: 'Consultoria em Estratégia de Marca',
    subtitle: 'Posicionamento, naming e rebranding para a sua marca.',
    minQty: '',
    brand: 'visualdesign',
    items: [
      { name: 'Estratégia de Posicionamento de Marca', price: 0, sobConsulta: true },
      { name: 'Naming (Criação de Nomes) e Slogans', price: 0, sobConsulta: true },
      { name: 'Rebranding e Modernização de Marcas', price: 0, sobConsulta: true },
      { name: 'Guidelines e Brandbook Completo', price: 0, sobConsulta: true },
    ],
  },
  {
    id: 'design-digital',
    label: 'Design para Redes Sociais',
    subtitle: 'Criativos digitais para Instagram, Facebook, LinkedIn e TikTok.',
    minQty: '',
    brand: 'visualdesign',
    items: [
      { name: 'Templates para Posts e Stories', price: 0, sobConsulta: true },
      { name: 'Criativos para Campanhas Publicitárias (Ads)', price: 0, sobConsulta: true },
      { name: 'Animações Curtas e Motion Graphics', price: 0, sobConsulta: true },
      { name: 'Pacote de Conteúdo Visual Mensal', price: 0, sobConsulta: true },
    ],
  },
  {
    id: 'envelopamento-viaturas',
    label: 'Envelopamento de Viaturas',
    subtitle: 'Branding móvel para a frota da sua empresa.',
    minQty: '',
    brand: 'visualdesign',
    items: [
      { name: 'Envelopamento Parcial da Viatura', price: 0, sobConsulta: true },
      { name: 'Envelopamento Total da Viatura', price: 0, sobConsulta: true },
    ],
  },

  // ============================================
  // VisualWeb — desenvolvimento web (não inclui domínio/hospedagem, vendidos à parte)
  // ============================================
  {
    id: 'web-design',
    label: 'Web Design',
    subtitle: 'Sites modernos, institucionais e landing pages responsivos, adaptados ao seu negócio.',
    minQty: '',
    brand: 'visualweb',
    items: [{ name: 'Website Institucional / Landing Page', price: 0, sobConsulta: true }],
  },
  {
    id: 'sistemas-web',
    label: 'Aplicações & Sistemas de Gestão',
    subtitle: 'Aplicações web personalizadas, plataformas SaaS e automação de processos internos.',
    minQty: '',
    brand: 'visualweb',
    items: [
      { name: 'Aplicação Web', price: 0, sobConsulta: true },
      { name: 'Sistema de Gestão', price: 0, sobConsulta: true },
    ],
  },
  {
    id: 'seo',
    label: 'Otimização para Buscadores (SEO)',
    subtitle: 'Posicionamento do seu site nos motores de busca.',
    minQty: '',
    brand: 'visualweb',
    items: [{ name: 'Otimização SEO', price: 0, sobConsulta: true }],
  },
  {
    id: 'redes-sociais',
    label: 'Gestão de Redes Sociais',
    subtitle: 'Gestão de conteúdo e presença nas redes sociais.',
    minQty: '',
    brand: 'visualweb',
    items: [{ name: 'Gestão de Redes Sociais', price: 0, sobConsulta: true }],
  },
  {
    id: 'loja-online',
    label: 'Lojas Online (E-commerce)',
    subtitle: 'Plataformas de venda online completas.',
    minQty: '',
    brand: 'visualweb',
    items: [{ name: 'Loja Online (E-commerce)', price: 0, sobConsulta: true }],
  },

  // ============================================
  // VisualTransporte
  // ============================================
  {
    id: 'mobilidade',
    label: 'Serviços de Mobilidade',
    subtitle: 'Logística de rotas e transferes de equipas corporativas.',
    minQty: '',
    brand: 'visualtransporte',
    items: [{ name: 'Serviço de Mobilidade Corporativa', price: 0, sobConsulta: true }],
  },
  {
    id: 'aluguer-viaturas',
    label: 'Aluguer de Viaturas',
    subtitle: 'Disponibilização de viaturas para eventos ou uso executivo.',
    minQty: '',
    brand: 'visualtransporte',
    items: [
      { name: 'Viatura para Evento Corporativo', price: 0, sobConsulta: true },
      { name: 'Transfere Executivo com Motorista', price: 0, sobConsulta: true },
    ],
  },
  {
    id: 'logistica-eventos-transporte',
    label: 'Logística de Eventos',
    subtitle: 'Transporte e montagem de estruturas no local.',
    minQty: '',
    brand: 'visualtransporte',
    items: [{ name: 'Logística e Transporte para Eventos', price: 0, sobConsulta: true }],
  },

  // ============================================
  // VisualEventos
  // ============================================
  {
    id: 'catering',
    label: 'Catering',
    subtitle: 'Serviço de catering para eventos corporativos e privados.',
    minQty: '',
    brand: 'visualeventos',
    items: [
      { name: 'Coffee Break Empresarial', price: 0, sobConsulta: true },
      { name: 'Brunch e Cocktails Volantes', price: 0, sobConsulta: true },
      { name: 'Banquetes e Jantares de Gala', price: 0, sobConsulta: true },
      { name: 'Menus Temáticos Customizados', price: 0, sobConsulta: true },
    ],
  },
  {
    id: 'feiras-eventos',
    label: 'Feiras e Eventos',
    subtitle: 'Stands, montagem e cobertura para feiras e conferências.',
    minQty: '',
    brand: 'visualeventos',
    items: [
      { name: 'Stands e Montagem 3D', price: 0, sobConsulta: true },
      { name: 'Aluguer de Equipamento de Som e Luz', price: 0, sobConsulta: true },
      { name: 'Sinalética e Cenografia de Evento', price: 0, sobConsulta: true },
      { name: 'Cobertura Fotográfica e Vídeo', price: 0, sobConsulta: true },
    ],
  },
  {
    id: 'organizacao-eventos',
    label: 'Organização de Eventos',
    subtitle: 'Aluguer de equipamento e organização completa de eventos.',
    minQty: '',
    brand: 'visualeventos',
    items: [
      { name: 'Aluguer de Equipamento', price: 0, sobConsulta: true },
      { name: 'Organização de Evento Completa', price: 0, sobConsulta: true },
    ],
  },

  // ============================================
  // VisualGifts
  // ============================================
  {
    id: 'kits-onboarding',
    label: 'Kits Onboarding',
    subtitle: 'Kits de boas-vindas personalizados para novos colaboradores ou clientes.',
    minQty: '',
    brand: 'visualgifts',
    items: [
      { name: 'Agenda / Caderno Personalizado', price: 0, sobConsulta: true },
      { name: 'Garrafa / Caneca Térmica Gravada', price: 0, sobConsulta: true },
      { name: 'Mochila / Tote Bag Personalizada', price: 0, sobConsulta: true },
      { name: 'Caneta Gravada com a Marca', price: 0, sobConsulta: true },
      { name: 'Pen Drive Personalizado', price: 0, sobConsulta: true },
    ],
  },
  {
    id: 'fardamento-texteis',
    label: 'Fardamento e Têxteis',
    subtitle: 'Fardamento corporativo e têxteis personalizados para a sua equipa.',
    minQty: '',
    brand: 'visualgifts',
    items: [
      { name: 'Polos e T-Shirts Promocionais', price: 0, sobConsulta: true },
      { name: 'Camisas de Alta Gama', price: 0, sobConsulta: true },
      { name: 'Coletes e Calças Técnicas', price: 0, sobConsulta: true },
      { name: 'Bordado de Alta Precisão', price: 0, sobConsulta: true },
      { name: 'Serigrafia / Sublimação / Estampagem', price: 0, sobConsulta: true },
    ],
  },
  {
    id: 'merchandising',
    label: 'Merchandising Promocional',
    subtitle: 'Brindes e artigos promocionais personalizados com a sua marca.',
    minQty: '',
    brand: 'visualgifts',
    items: [{ name: 'Merchandising Promocional', price: 0, sobConsulta: true }],
  },

  // ============================================
  // VisualPro — fotografia e vídeo profissional/corporativo
  // ============================================
  {
    id: 'video-corporativo',
    label: 'Produção de Vídeo Corporativo',
    subtitle: 'Vídeos institucionais, comerciais e para redes sociais.',
    minQty: '',
    brand: 'visualpro',
    items: [
      { name: 'Vídeo Institucional', price: 0, sobConsulta: true },
      { name: 'Vídeo Comercial', price: 0, sobConsulta: true },
      { name: 'Conteúdo para Redes Sociais', price: 0, sobConsulta: true },
      { name: 'Pós-produção e Edição', price: 0, sobConsulta: true },
    ],
  },
  {
    id: 'fotografia-profissional',
    label: 'Fotografia Profissional',
    subtitle: 'Fotografia de produto, corporativa e cobertura de eventos.',
    minQty: '',
    brand: 'visualpro',
    items: [
      { name: 'Fotografia de Produto / E-commerce', price: 0, sobConsulta: true },
      { name: 'Fotografia Corporativa (Equipa e Instalações)', price: 0, sobConsulta: true },
      { name: 'Cobertura de Feiras e Conferências', price: 0, sobConsulta: true },
      { name: 'Edição e Tratamento de Imagem', price: 0, sobConsulta: true },
    ],
  },
  {
    id: 'cobertura-eventos-pro',
    label: 'Cobertura de Eventos',
    subtitle: 'Cobertura profissional de vídeo e fotografia para eventos.',
    minQty: '',
    brand: 'visualpro',
    items: [
      { name: 'Gravação com Câmaras de Cinema Digitais', price: 0, sobConsulta: true },
      { name: 'Reportagem Fotográfica de Evento', price: 0, sobConsulta: true },
      { name: 'Aftermovie (Vídeo Resumo)', price: 0, sobConsulta: true },
    ],
  },
]

export function formatMt(value: number) {
  const rounded = Math.round(value * 100) / 100
  const isWhole = Number.isInteger(rounded)
  return rounded.toLocaleString('pt-PT', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export function findCategory(categoryId: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === categoryId)
}

export function findItem(categoryId: string, productName: string): { category: Category; item: PriceItem } | undefined {
  const category = findCategory(categoryId)
  if (!category) return undefined
  const item = category.items.find((i) => i.name === productName)
  if (!item) return undefined
  return { category, item }
}

export function categoriesForBrand(brandId: string): Category[] {
  return CATEGORIES.filter((c) => c.brand === brandId)
}

// Chave usada para transportar a selecção de checkboxes de /precos para /cotacao
// (sessionStorage, leitura única — ver src/app/cotacao/page.tsx).
export const SELECAO_STORAGE_KEY = 'visualdesign_precos_selecao'

export type SelectedCatalogItem = {
  categoriaId: string
  produto: string
  categoriaLabel: string
}
