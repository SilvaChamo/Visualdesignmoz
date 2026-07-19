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
 * marca (/visualweb, /visualdesign, ...) para gerar a grelha de serviços de cada uma.
 * Os URLs dos serviços mantêm-se todos em /servicos/* (SEO), só o agrupamento é novo.
 */
export const SERVICE_BRANDS: ServiceBrand[] = [
  {
    slug: 'visualweb',
    name: 'VisualWeb',
    tagline: 'Presença digital: sites, marketing e infraestrutura',
    color: 'blue',
    services: [
      { slug: 'webdesign', title: 'Webdesign', desc: 'Websites profissionais, responsivos e otimizados.', href: '/servicos/webdesign' },
      { slug: 'marketing-digital', title: 'Marketing Digital', desc: 'Campanhas de tráfego pago e estratégias de crescimento.', href: '/servicos/marketing-digital' },
      { slug: 'redes-sociais', title: 'Redes Sociais', desc: 'Gestão e produção de conteúdo para as suas redes.', href: '/servicos/redes-sociais' },
      { slug: 'seo', title: 'SEO', desc: 'Otimização para motores de busca e visibilidade orgânica.', href: '/servicos/seo' },
      { slug: 'dominios', title: 'Domínios', desc: 'Registo e gestão de domínios .com, .co.mz e mais.', href: '/servicos/dominios' },
      { slug: 'hospedagem', title: 'Hospedagem', desc: 'Alojamento web rápido, seguro e com suporte 24/7.', href: '/servicos/hospedagem' },
      { slug: 'servidor', title: 'Servidor', desc: 'VPS e servidores dedicados para projetos exigentes.', href: '/servicos/servidor' },
      { slug: 'ssl', title: 'SSL', desc: 'Certificados de segurança para o seu website.', href: '/servicos/ssl' },
      { slug: 'email', title: 'Email Profissional', desc: 'Contas de email com o seu próprio domínio.', href: '/servicos/email' },
    ],
  },
  {
    slug: 'visualdesign',
    name: 'VisualDesign',
    tagline: 'Identidade visual, marca e imagem',
    color: 'red',
    services: [
      { slug: 'design-grafico', title: 'Design Gráfico', desc: 'Identidade visual e materiais promocionais.', href: '/servicos/design-grafico' },
      { slug: 'branding', title: 'Branding', desc: 'Estratégia e construção de marca de ponta a ponta.', href: '/servicos/branding' },
      { slug: 'fotografia', title: 'Fotografia', desc: 'Sessões fotográficas profissionais e de eventos.', href: '/servicos/fotografia' },
    ],
  },
  {
    slug: 'visualeventos',
    name: 'VisualEventos',
    tagline: 'Feiras, eventos e produção audiovisual',
    color: 'amber',
    services: [
      { slug: 'feiras-eventos', title: 'Feiras e Eventos', desc: 'Design de stands e cobertura completa de eventos.', href: '/servicos/feiras-eventos' },
      { slug: 'catering', title: 'Catering', desc: 'Serviço de catering para eventos corporativos e privados.', href: '/servicos/catering' },
      { slug: 'aluguer', title: 'Aluguer de Equipamento', desc: 'Aluguer de material técnico e mobiliário para eventos.', href: '/servicos/aluguer' },
      { slug: 'organizacao', title: 'Organização de Eventos', desc: 'Planeamento e execução de eventos de ponta a ponta.', href: '/servicos/organizacao' },
    ],
  },
  {
    slug: 'visualpro',
    name: 'VisualPro',
    tagline: 'Produção de vídeo profissional',
    color: 'violet',
    services: [
      { slug: 'video-producao', title: 'Produção de Vídeo', desc: 'Vídeos institucionais, publicitários, de eventos e para redes sociais.', href: '/servicos/video-producao' },
    ],
  },
  {
    slug: 'visualtransporte',
    name: 'VisualTransporte',
    tagline: 'Envelopamento de viaturas e mobilidade',
    color: 'slate',
    services: [
      { slug: 'envelopamento', title: 'Envelopamento', desc: 'Branding e envelopamento de viaturas para a sua frota.', href: '/servicos/envelopamento' },
      { slug: 'mobilidade', title: 'Serviços de Mobilidade', desc: 'Logística e transferes para pessoas e mercadorias.', href: '/servicos/mobilidade' },
    ],
  },
  {
    slug: 'visualgifts',
    name: 'VisualGifts',
    tagline: 'Merchandising, têxteis e kits corporativos',
    color: 'emerald',
    services: [
      { slug: 'merchandising', title: 'Merchandising', desc: 'Brindes e artigos promocionais personalizados com a sua marca.', href: '/servicos/merchandising' },
      { slug: 'texteis', title: 'Têxteis', desc: 'Fardamento e têxteis personalizados para empresas e eventos.', href: '/servicos/texteis' },
      { slug: 'kits-onboarding', title: 'Kits Onboarding', desc: 'Kits de boas-vindas personalizados para novos colaboradores.', href: '/servicos/kits-onboarding' },
    ],
  },
];

export function getServiceBrand(slug: string): ServiceBrand | undefined {
  return SERVICE_BRANDS.find((b) => b.slug === slug);
}
