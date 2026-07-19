import {
  Globe, Mail, ShieldCheck, DatabaseBackup, RefreshCw, AppWindow,
  Camera, Palette, Sparkles,
  Tent, Coffee, Truck as TruckIcon, Users, Clock,
  Video, Zap, Smile,
  Car, Route, MapPin,
  Gift, Shirt, PackageOpen, Award,
  type LucideIcon,
} from 'lucide-react';

export type WhyUsItem = {
  Icon: LucideIcon;
  title: string;
  teaser: string;
  desc: string;
};

export type ServiceIconItem = {
  Icon: LucideIcon;
  title: string;
  desc: string;
  href: string;
};

export type BrandLandingContent = {
  slug: string;
  hero: {
    title: string;
    subtitle: string;
    badges: string[];
    ctaLabel: string;
    ctaHref: string;
    /** Se vazio, usa fundo escuro liso (BG.jpg) em vez de foto temática. */
    imageSrc?: string;
  };
  intro: {
    title: string;
    text: string;
  };
  servicesPretitle: string;
  servicesTitle: string;
  servicesSubtitle: string;
  services: ServiceIconItem[];
  whyUsPretitle: string;
  whyUsTitle: string;
  whyUsSubtitle: string;
  whyUs: WhyUsItem[];
  cta: {
    title: string;
    subtitle: string;
    buttonLabel: string;
    buttonHref: string;
  };
};

export const BRAND_LANDING_CONTENT: Record<string, BrandLandingContent> = {
  visualdesign: {
    slug: 'visualdesign',
    hero: {
      title: 'Identidade visual que fica na memória',
      subtitle:
        'Branding, design gráfico e fotografia profissional para marcas que querem destacar-se — do logótipo à sessão fotográfica.',
      badges: ['Identidade de marca', 'Fotografia profissional', 'Materiais gráficos'],
      ctaLabel: 'Pedir Orçamento',
      ctaHref: '/contacto',
      imageSrc: '/assets/graphic-design-illustration.png',
    },
    intro: {
      title: 'A marca certa muda tudo',
      text: 'A VisualDesign cuida da imagem da sua empresa do primeiro rascunho à entrega final — identidade visual, branding e fotografia profissional, sempre alinhados com quem é a sua marca.',
    },
    servicesPretitle: 'O que fazemos',
    servicesTitle: 'Design, marca e imagem',
    servicesSubtitle: 'Tudo o que a sua marca precisa para ter uma imagem consistente e profissional.',
    services: [
      { Icon: Palette, title: 'Design Gráfico', desc: 'Identidade visual e materiais promocionais.', href: '/servicos/design-grafico' },
      { Icon: Sparkles, title: 'Branding', desc: 'Estratégia e construção de marca de ponta a ponta.', href: '/servicos/branding' },
      { Icon: Camera, title: 'Fotografia', desc: 'Sessões fotográficas profissionais e de eventos.', href: '/servicos/fotografia' },
    ],
    whyUsPretitle: 'Porquê a VisualDesign',
    whyUsTitle: 'Um único parceiro para toda a sua imagem',
    whyUsSubtitle: 'Do conceito à entrega final, sem perder consistência entre serviços.',
    whyUs: [
      { Icon: Sparkles, title: 'Criatividade à medida', teaser: 'Cada marca é única — o design também deve ser.', desc: 'Não usamos templates genéricos. Cada projecto parte de uma análise da sua marca e do seu público antes de chegar ao conceito visual.' },
      { Icon: Award, title: 'Portefólio comprovado', teaser: 'Trabalhos reais, entregues a clientes reais.', desc: 'Anos de experiência a criar identidades visuais, campanhas e sessões fotográficas para empresas em diferentes sectores.' },
      { Icon: Clock, title: 'Prazos cumpridos', teaser: 'Entrega dentro do prazo acordado, sempre.', desc: 'Planeamos cada projecto com etapas claras e datas realistas, para que nunca fique à espera sem saber em que ponto está o trabalho.' },
      { Icon: Users, title: 'Um único ponto de contacto', teaser: 'Do logótipo à fotografia, tudo coordenado.', desc: 'Não precisa de gerir vários fornecedores — a mesma equipa acompanha a sua marca em todas as frentes visuais.' },
    ],
    cta: {
      title: 'Pronto para dar uma nova imagem à sua marca?',
      subtitle: 'Fale connosco e receba uma proposta personalizada, sem compromisso.',
      buttonLabel: 'Pedir Orçamento',
      buttonHref: '/contacto',
    },
  },

  visualeventos: {
    slug: 'visualeventos',
    hero: {
      title: 'Eventos memoráveis, do conceito à execução',
      subtitle:
        'Feiras, conferências, catering e aluguer de equipamento — organizamos tudo para que o seu evento corra sem imprevistos.',
      badges: ['Stands e feiras', 'Catering', 'Aluguer de equipamento'],
      ctaLabel: 'Falar sobre o meu evento',
      ctaHref: '/contacto',
      imageSrc: '/assets/feiras-eventos-illustration.png',
    },
    intro: {
      title: 'Eventos que ficam na memória',
      text: 'A VisualEventos trata de tudo o que o seu evento precisa — do conceito e do stand ao catering e ao aluguer de equipamento — para que só precise de aparecer no dia.',
    },
    servicesPretitle: 'O que fazemos',
    servicesTitle: 'Tudo para o seu evento',
    servicesSubtitle: 'De uma feira corporativa a um evento privado — cobrimos todas as etapas.',
    services: [
      { Icon: Tent, title: 'Feiras e Eventos', desc: 'Design de stands e cobertura completa de eventos.', href: '/servicos/feiras-eventos' },
      { Icon: Coffee, title: 'Catering', desc: 'Serviço de catering para eventos corporativos e privados.', href: '/servicos/catering' },
      { Icon: TruckIcon, title: 'Aluguer de Equipamento', desc: 'Aluguer de material técnico e mobiliário para eventos.', href: '/servicos/aluguer' },
      { Icon: Users, title: 'Organização de Eventos', desc: 'Planeamento e execução de eventos de ponta a ponta.', href: '/servicos/organizacao' },
    ],
    whyUsPretitle: 'Porquê a VisualEventos',
    whyUsTitle: 'Um evento, uma só equipa',
    whyUsSubtitle: 'Coordenamos todos os fornecedores para que só precise de falar connosco.',
    whyUs: [
      { Icon: Users, title: 'Equipa no terreno', teaser: 'Presente no dia do evento, do início ao fim.', desc: 'Acompanhamos a montagem, o decorrer e a desmontagem — não desaparecemos depois de assinado o contrato.' },
      { Icon: Tent, title: 'Fornecedores coordenados', teaser: 'Catering, aluguer e stands sob um só ponto de contacto.', desc: 'Gerimos a logística entre todos os fornecedores envolvidos, para que não tenha de coordenar nada sozinho.' },
      { Icon: Clock, title: 'Planeamento de ponta a ponta', teaser: 'Do conceito ao dia do evento.', desc: 'Cada evento tem um plano detalhado com prazos, responsáveis e contingências definidas antecipadamente.' },
      { Icon: Zap, title: 'Flexibilidade de última hora', teaser: 'Imprevistos acontecem — estamos preparados.', desc: 'A nossa equipa resolve imprevistos no local sem comprometer a experiência dos seus convidados.' },
    ],
    cta: {
      title: 'Tem um evento a preparar?',
      subtitle: 'Conte-nos os detalhes e receba uma proposta personalizada.',
      buttonLabel: 'Falar sobre o meu evento',
      buttonHref: '/contacto',
    },
  },

  visualpro: {
    slug: 'visualpro',
    hero: {
      title: 'Vídeo profissional para a sua marca',
      subtitle:
        'Vídeos institucionais, publicitários, de eventos e para redes sociais — produzidos com equipamento e equipa profissional.',
      badges: ['Vídeo institucional', 'Publicidade', 'Redes sociais'],
      ctaLabel: 'Pedir Orçamento',
      ctaHref: '/contacto',
    },
    intro: {
      title: 'Vídeo que conta a história certa',
      text: 'A VisualPro produz vídeo profissional para a sua marca — institucional, publicitário ou para redes sociais — da pré-produção à entrega final.',
    },
    servicesPretitle: 'O que fazemos',
    servicesTitle: 'Produção de vídeo',
    servicesSubtitle: 'Conteúdo em vídeo pensado para o objectivo certo — institucional, publicitário ou social.',
    services: [
      { Icon: Video, title: 'Produção de Vídeo', desc: 'Vídeos institucionais, publicitários, de eventos e para redes sociais.', href: '/servicos/video-producao' },
    ],
    whyUsPretitle: 'Porquê a VisualPro',
    whyUsTitle: 'Vídeo com qualidade profissional',
    whyUsSubtitle: 'Da pré-produção à edição final.',
    whyUs: [
      { Icon: Video, title: 'Equipamento profissional', teaser: 'Imagem e som à altura da sua marca.', desc: 'Trabalhamos com câmaras, iluminação e áudio profissionais, adequados a cada tipo de produção.' },
      { Icon: Users, title: 'Equipa experiente', teaser: 'Direcção, filmagem e edição sob o mesmo tecto.', desc: 'Acompanhamos o projecto do guião à entrega final, sem depender de terceiros para cada etapa.' },
      { Icon: Clock, title: 'Entrega rápida', teaser: 'Prazos definidos antes de começar a filmar.', desc: 'Sabe desde o início quando vai receber o vídeo final, incluindo tempo para revisões.' },
      { Icon: Smile, title: 'Adaptado a cada plataforma', teaser: 'Formato certo para cada ecrã.', desc: 'Preparamos versões optimizadas para redes sociais, televisão ou apresentações internas, conforme o objectivo.' },
    ],
    cta: {
      title: 'Precisa de um vídeo para a sua marca?',
      subtitle: 'Conte-nos o que tem em mente e receba uma proposta personalizada.',
      buttonLabel: 'Pedir Orçamento',
      buttonHref: '/contacto',
    },
  },

  visualtransporte: {
    slug: 'visualtransporte',
    hero: {
      title: 'A sua marca em movimento',
      subtitle:
        'Envelopamento de viaturas e serviços de mobilidade — transforme a sua frota num anúncio móvel ou conte connosco para transferes e logística.',
      badges: ['Envelopamento de frota', 'Transferes', 'Logística'],
      ctaLabel: 'Pedir Orçamento',
      ctaHref: '/contacto',
    },
    intro: {
      title: 'A sua marca em cada deslocação',
      text: 'A VisualTransporte cobre o envelopamento da sua frota e os serviços de mobilidade que o seu negócio precisa, com fiabilidade do início ao fim.',
    },
    servicesPretitle: 'O que fazemos',
    servicesTitle: 'Envelopamento e mobilidade',
    servicesSubtitle: 'Branding de viaturas e serviços de transporte para pessoas e mercadorias.',
    services: [
      { Icon: Car, title: 'Envelopamento', desc: 'Branding e envelopamento de viaturas para a sua frota.', href: '/servicos/envelopamento' },
      { Icon: Route, title: 'Serviços de Mobilidade', desc: 'Logística e transferes para pessoas e mercadorias.', href: '/servicos/mobilidade' },
    ],
    whyUsPretitle: 'Porquê a VisualTransporte',
    whyUsTitle: 'Fiabilidade em cada deslocação',
    whyUsSubtitle: 'Frota, materiais e logística pensados para o seu negócio.',
    whyUs: [
      { Icon: ShieldCheck, title: 'Materiais duráveis', teaser: 'Vinil resistente a sol e chuva.', desc: 'O envelopamento é feito com materiais de alta durabilidade, com garantia de aplicação.' },
      { Icon: TruckIcon, title: 'Frota sempre disponível', teaser: 'Transferes e logística quando precisar.', desc: 'Serviços pontuais ou contratos contínuos, adaptados ao ritmo do seu negócio.' },
      { Icon: MapPin, title: 'Cobertura alargada', teaser: 'Rotas dentro e fora da cidade.', desc: 'Planeamos rotas eficientes para reduzir custos e tempo de deslocação.' },
      { Icon: Clock, title: 'Pontualidade', teaser: 'Compromissos cumpridos, sempre.', desc: 'Acompanhamos cada serviço de perto para garantir que chega a horas.' },
    ],
    cta: {
      title: 'Precisa de envelopar a sua frota ou de transporte?',
      subtitle: 'Fale connosco e receba uma proposta personalizada.',
      buttonLabel: 'Pedir Orçamento',
      buttonHref: '/contacto',
    },
  },

  visualgifts: {
    slug: 'visualgifts',
    hero: {
      title: 'Brindes que representam a sua marca',
      subtitle:
        'Merchandising, têxteis e kits de boas-vindas personalizados — para colaboradores, clientes e eventos.',
      badges: ['Merchandising', 'Fardamento', 'Kits corporativos'],
      ctaLabel: 'Pedir Orçamento',
      ctaHref: '/contacto',
    },
    intro: {
      title: 'Brindes que representam bem a sua marca',
      text: 'A VisualGifts cria merchandising, têxteis e kits corporativos personalizados, prontos para o seu evento, campanha ou onboarding.',
    },
    servicesPretitle: 'O que fazemos',
    servicesTitle: 'Merchandising e brindes corporativos',
    servicesSubtitle: 'Artigos personalizados com a sua marca, para todas as ocasiões.',
    services: [
      { Icon: Gift, title: 'Merchandising', desc: 'Brindes e artigos promocionais personalizados com a sua marca.', href: '/servicos/merchandising' },
      { Icon: Shirt, title: 'Têxteis', desc: 'Fardamento e têxteis personalizados para empresas e eventos.', href: '/servicos/texteis' },
      { Icon: PackageOpen, title: 'Kits Onboarding', desc: 'Kits de boas-vindas personalizados para novos colaboradores.', href: '/servicos/kits-onboarding' },
    ],
    whyUsPretitle: 'Porquê a VisualGifts',
    whyUsTitle: 'Brindes com a qualidade da sua marca',
    whyUsSubtitle: 'Personalização, qualidade e entrega coordenada.',
    whyUs: [
      { Icon: Sparkles, title: 'Personalização total', teaser: 'Cores, logótipo e mensagem à sua medida.', desc: 'Cada artigo é personalizado de acordo com a identidade da sua marca, sem soluções genéricas.' },
      { Icon: Award, title: 'Qualidade consistente', teaser: 'Materiais escolhidos com cuidado.', desc: 'Trabalhamos com fornecedores de confiança para garantir consistência em cada encomenda.' },
      { Icon: PackageOpen, title: 'Preços por volume', teaser: 'Vantagens em encomendas maiores.', desc: 'Condições especiais para encomendas corporativas de maior quantidade.' },
      { Icon: Clock, title: 'Entrega coordenada', teaser: 'Pronto a tempo do seu evento ou onboarding.', desc: 'Planeamos a produção e entrega em função da data que precisa — evento, campanha ou integração de um novo colaborador.' },
    ],
    cta: {
      title: 'Precisa de brindes para a sua empresa?',
      subtitle: 'Conte-nos a ocasião e receba uma proposta personalizada.',
      buttonLabel: 'Pedir Orçamento',
      buttonHref: '/contacto',
    },
  },
};

export function getBrandLandingContent(slug: string): BrandLandingContent | undefined {
  return BRAND_LANDING_CONTENT[slug];
}
