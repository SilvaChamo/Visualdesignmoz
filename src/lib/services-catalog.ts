export type ServiceCatalogItem = {
  slug: string;
  title: string;
  desc: string;
  href: string;
};

export type ServiceBrand = {
  slug: string;
  name: string;
  tagline: string;
  color: string; // classe tailwind usada como acento na página da marca
  services: ServiceCatalogItem[];
};

/**
 * Fonte única das 5 verticais de negócio da VisualDesign. Usado pelas páginas de
 * marca (/web, /visualdesign, ...) para gerar a grelha de serviços de cada uma.
 * Os URLs dos serviços mantêm-se todos em /servicos/* (SEO), só o agrupamento é novo.
 */
export const SERVICE_BRANDS: ServiceBrand[] = [
  {
    slug: 'web',
    name: 'VisualWeb',
    tagline: 'Presença digital: sites, marketing e infraestrutura',
    color: 'blue',
    services: [
      { slug: 'webdesign', title: 'Webdesign', desc: 'Websites profissionais, responsivos e otimizados.', href: '/web' },
      { slug: 'marketing-digital', title: 'Marketing Digital', desc: 'Campanhas de tráfego pago e estratégias de crescimento.', href: '/web' },
      { slug: 'redes-sociais', title: 'Redes Sociais', desc: 'Gestão e produção de conteúdo para as suas redes.', href: '/web' },
      { slug: 'seo', title: 'SEO', desc: 'Otimização para motores de busca e visibilidade orgânica.', href: '/web' },
      { slug: 'dominios', title: 'Domínios', desc: 'Registo e gestão de domínios .com, .co.mz e mais.', href: '/precos/dominios' },
      { slug: 'hospedagem', title: 'Hospedagem', desc: 'Alojamento web rápido, seguro e com suporte 24/7.', href: '/precos/hospedagem' },
      { slug: 'servidor', title: 'Servidor', desc: 'VPS e servidores dedicados para projectos exigentes.', href: '/web' },
      { slug: 'ssl', title: 'SSL', desc: 'Certificados de segurança para o seu website.', href: '/precos/ssl' },
      { slug: 'email', title: 'Email Profissional', desc: 'Contas de email com o seu próprio domínio.', href: '/precos/email' },
    ],
  },
  {
    slug: 'visualdesign',
    name: 'VisualDesign',
    tagline: 'Identidade visual, marca e imagem',
    color: 'red',
    services: [
      { slug: 'design-grafico', title: 'Design Gráfico', desc: 'Identidade visual e materiais promocionais.', href: '/#design' },
      { slug: 'branding', title: 'Branding', desc: 'Estratégia e construção de marca de ponta a ponta.', href: '/#design' },
      { slug: 'envelopamento', title: 'Envelopamento', desc: 'Branding e envelopamento de viaturas para a sua frota.', href: '/#envelopamento' },
    ],
  },
  {
    slug: 'eventos',
    name: 'VisualEventos',
    tagline: 'Feiras, eventos e produção audiovisual',
    color: 'amber',
    services: [
      { slug: 'feiras-eventos', title: 'Feiras e Eventos', desc: 'Design de stands e cobertura completa de eventos.', href: '/eventos/feiras' },
      { slug: 'catering', title: 'Catering', desc: 'Serviço de catering para eventos corporativos e privados.', href: '/eventos/catering' },
      { slug: 'aluguer', title: 'Aluguer de Equipamento', desc: 'Aluguer de material técnico e mobiliário para eventos.', href: '/eventos' },
      { slug: 'organizacao', title: 'Organização de Eventos', desc: 'Planeamento e execução de eventos de ponta a ponta.', href: '/eventos' },
    ],
  },
  {
    slug: 'producoes',
    name: 'VisualPro',
    tagline: 'Produção de vídeo profissional e fotografia',
    color: 'violet',
    services: [
      { slug: 'video-producao', title: 'Produção de Vídeo', desc: 'Vídeos institucionais, publicitários, de eventos e para redes sociais.', href: '/producoes' },
      { slug: 'fotografia', title: 'Fotografia Profissional', desc: 'Sessões fotográficas, produtos e retratos corporativos.', href: '/producoes/fotografia' },
      { slug: 'eventos', title: 'Cobertura de Eventos', desc: 'Cobertura completa de foto e vídeo para congressos e feiras.', href: '/producoes/eventos' },
    ],
  },
  {
    slug: 'transporte',
    name: 'VisualTransporte',
    tagline: 'Serviços de mobilidade e logística corporativa',
    color: 'slate',
    services: [
      { slug: 'mobilidade', title: 'Serviços de Mobilidade', desc: 'Logística e transferes para pessoas e mercadorias.', href: '/transporte' },
      { slug: 'aluguer-viaturas', title: 'Aluguer de Viaturas', desc: 'Disponibilização de viaturas para eventos ou uso executivo.', href: '/transporte' },
      { slug: 'logistica-eventos', title: 'Logística de Eventos', desc: 'Transporte de materiais e montagem de estruturas.', href: '/transporte' },
    ],
  },
  {
    slug: 'brindes',
    name: 'VisualGifts',
    tagline: 'Merchandising, têxteis e kits corporativos',
    color: 'emerald',
    services: [
      { slug: 'merchandising', title: 'Merchandising', desc: 'Brindes e artigos promocionais personalizados com a sua marca.', href: '/brindes' },
      { slug: 'texteis', title: 'Têxteis', desc: 'Fardamento e têxteis personalizados para empresas e eventos.', href: '/brindes/texteis' },
      { slug: 'kits-onboarding', title: 'Kits Onboarding', desc: 'Kits de boas-vindas personalizados para novos colaboradores.', href: '/brindes/kits' },
    ],
  },
];

export function getServiceBrand(slug: string): ServiceBrand | undefined {
  return SERVICE_BRANDS.find((b) => b.slug === slug);
}
