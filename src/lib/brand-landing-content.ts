import {
  Globe, Mail, ShieldCheck, DatabaseBackup, RefreshCw, AppWindow,
  Camera, Palette, Sparkles,
  Tent, Coffee, Truck as TruckIcon, Users, Clock,
  Video, Zap, Smile,
  Car, Route, MapPin,
  Gift, Shirt, PackageOpen, Award,
  Inbox, Workflow, Headphones, Wallet, LayoutDashboard, Megaphone, Calendar, Monitor,
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
        'Branding, design gráfico e envelopamento profissional para marcas que querem destacar-se — do logótipo à viatura da sua frota.',
      badges: ['Identidade de marca', 'Design gráfico', 'Envelopamento'],
      ctaLabel: 'Pedir Orçamento',
      ctaHref: '/contacto',
      imageSrc: '/assets/graphic-design-illustration.png',
    },
    intro: {
      title: 'A marca certa muda tudo',
      text: 'A VisualDesign cuida da imagem da sua empresa do primeiro rascunho à entrega final — identidade visual, branding e envelopamento de viaturas, sempre alinhados com quem é a sua marca.',
    },
    servicesPretitle: 'O que fazemos',
    servicesTitle: 'Design, marca e imagem',
    servicesSubtitle: 'Tudo o que a sua marca precisa para ter uma imagem consistente e profissional.',
    services: [
      { Icon: Palette, title: 'Design Gráfico', desc: 'Identidade de marca, logótipos e manuais de normas.', href: '/#design' },
      { Icon: Sparkles, title: 'Branding', desc: 'Estratégia e construção de marca de ponta a ponta.', href: '/#design' },
      { Icon: Car, title: 'Envelopamento', desc: 'Branding móvel e envelopamento de viaturas para a sua frota.', href: '/#envelopamento' },
    ],
    whyUsPretitle: 'Porquê a VisualDesign',
    whyUsTitle: 'Um único parceiro para toda a sua imagem',
    whyUsSubtitle: 'Do conceito à entrega final, sem perder consistência entre serviços.',
    whyUs: [
      { Icon: Sparkles, title: 'Criatividade à medida', teaser: 'Cada marca é única — o design também deve ser.', desc: 'Não usamos templates genéricos. Cada projecto parte de uma análise da sua marca e do seu público antes de chegar ao conceito visual.' },
      { Icon: Award, title: 'Portefólio comprovado', teaser: 'Trabalhos reais, entregues a clientes reais.', desc: 'Anos de experiência a criar identidades visuais, campanhas e envelopamentos para empresas em diferentes sectores.' },
      { Icon: Clock, title: 'Prazos cumpridos', teaser: 'Entrega dentro do prazo acordado, sempre.', desc: 'Planeamos cada projecto com etapas claras e datas realistas, para que nunca fique à espera sem saber em que ponto está o trabalho.' },
      { Icon: Users, title: 'Um único ponto de contacto', teaser: 'Do logótipo ao envelopamento, tudo coordenado.', desc: 'Não precisa de gerir vários fornecedores — a mesma equipa acompanha a sua marca em todas as frentes visuais.' },
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
      { Icon: Tent, title: 'Feiras e Eventos', desc: 'Design de stands e cobertura completa de eventos.', href: '/visualeventos/feiras' },
      { Icon: Coffee, title: 'Catering', desc: 'Serviço de catering para eventos corporativos e privados.', href: '/visualeventos/catering' },
      { Icon: TruckIcon, title: 'Aluguer de Equipamento', desc: 'Aluguer de material técnico e mobiliário para eventos.', href: '/visualeventos' },
      { Icon: Users, title: 'Organização de Eventos', desc: 'Planeamento e execução de eventos de ponta a ponta.', href: '/visualeventos' },
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
      title: 'Vídeo e fotografia profissional para a sua marca',
      subtitle:
        'Vídeos institucionais, spot TV, cobertura audiovisual de eventos e sessões fotográficas profissionais em Moçambique.',
      badges: ['Vídeo institucional', 'Cobertura de eventos', 'Fotografia profissional'],
      ctaLabel: 'Pedir Orçamento',
      ctaHref: '/contacto',
    },
    intro: {
      title: 'Histórias que ligam e comunicam',
      text: 'A VisualPro produz vídeo e fotografia profissional para a sua marca — corporativa, publicitária ou para cobertura de eventos — da pré-produção à entrega final.',
    },
    servicesPretitle: 'O que fazemos',
    servicesTitle: 'Produção Audiovisual',
    servicesSubtitle: 'Conteúdo profissional em foto e vídeo adaptado ao seu mercado e objectivos.',
    services: [
      { Icon: Video, title: 'Produção de Vídeo', desc: 'Vídeos institucionais, spot TV e conteúdos publicitários.', href: '/visualpro' },
      { Icon: Camera, title: 'Fotografia Profissional', desc: 'Sessões de produto, retrato corporate e instalações.', href: '/visualpro/fotografia' },
      { Icon: Users, title: 'Cobertura de Eventos', desc: 'Foto e vídeo ao vivo para congressos e feiras.', href: '/visualpro/eventos' },
    ],
    whyUsPretitle: 'Porquê a VisualPro',
    whyUsTitle: 'Vídeo e imagem com qualidade de cinema',
    whyUsSubtitle: 'Da captação no local à edição final.',
    whyUs: [
      { Icon: Video, title: 'Equipamento topo de gama', teaser: 'Imagem e som de alta fidelidade.', desc: 'Trabalhamos com câmaras de cinema digital, sistemas de iluminação e som dedicados a produções profissionais.' },
      { Icon: Users, title: 'Equipa dedicada', teaser: 'Fotógrafos, videógrafos e editores experientes.', desc: 'Uma equipa sintonizada que acompanha o projecto do guião até à entrega da nuvem de ficheiros.' },
      { Icon: Clock, title: 'Prazos definidos', teaser: 'Acompanhamento e datas realistas.', desc: 'Sabe exatamente quando receberá os seus conteúdos, com tempo garantido para revisões e ajustes.' },
      { Icon: Smile, title: 'Formatos otimizados', teaser: 'Formatos certos para cada canal.', desc: 'Entregamos versões otimizadas para redes sociais (vertical), apresentações corporativas ou spot de televisão.' },
    ],
    cta: {
      title: 'Precisa de um vídeo ou fotografia profissional?',
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
        'Serviços de mobilidade executiva, transferes corporativos e logística de transporte para pessoas e mercadorias.',
      badges: ['Transferes', 'Logística', 'Mobilidade'],
      ctaLabel: 'Pedir Orçamento',
      ctaHref: '/contacto',
    },
    intro: {
      title: 'Mobilidade fiável e planeada',
      text: 'A VisualTransporte cobre as necessidades de logística de transporte, transferes e deslocações da sua empresa com profissionalismo e pontualidade.',
    },
    servicesPretitle: 'O que fazemos',
    servicesTitle: 'Mobilidade e Logística',
    servicesSubtitle: 'Serviços de transporte corporativo e aluguer de viaturas.',
    services: [
      { Icon: Route, title: 'Serviços de Mobilidade', desc: 'Logística de rotas e transferes de equipas corporativas.', href: '/visualtransporte' },
      { Icon: Car, title: 'Aluguer de Viaturas', desc: 'Disponibilização de viaturas para eventos ou uso executivo.', href: '/visualtransporte' },
      { Icon: TruckIcon, title: 'Logística de Eventos', desc: 'Transporte e montagem de estruturas no local.', href: '/visualtransporte' },
    ],
    whyUsPretitle: 'Porquê a VisualTransporte',
    whyUsTitle: 'Pontualidade e Segurança Absoluta',
    whyUsSubtitle: 'Logística e rotas eficientes.',
    whyUs: [
      { Icon: ShieldCheck, title: 'Segurança garantida', teaser: 'Condutores experientes e viaturas licenciadas.', desc: 'Toda a nossa frota é inspecionada regularmente e os condutores têm formação de condução defensiva.' },
      { Icon: TruckIcon, title: 'Viaturas confortáveis', teaser: 'Conforto e qualidade no transporte.', desc: 'Viaturas modernas e climatizadas prontas para receber clientes e equipas executivas.' },
      { Icon: MapPin, title: 'Gestão de Rotas', teaser: 'Otimização de tempo e recursos.', desc: 'Planeamos rotas antecipadas para evitar atrasos no trânsito urbano ou suburbano.' },
      { Icon: Clock, title: 'Pontualidade rigorosa', teaser: 'Chegada no horário marcado.', desc: 'Acompanhamos cada deslocação em tempo real para garantir cumprimento total do plano.' },
    ],
    cta: {
      title: 'Precisa de transporte ou logística corporativa?',
      subtitle: 'Fale connosco e receba uma proposta de rotas ou contratação contínua.',
      buttonLabel: 'Pedir Orçamento',
      buttonHref: '/contacto',
    },
  },

  visualgifts: {
    slug: 'visualgifts',
    hero: {
      title: 'Brindes que representam a sua marca',
      subtitle:
        'Merchandising personalizado, fardamento de equipas e kits de boas-vindas onboarding personalizados.',
      badges: ['Merchandising', 'Têxteis', 'Kits onboarding'],
      ctaLabel: 'Pedir Orçamento',
      ctaHref: '/contacto',
    },
    intro: {
      title: 'Artigos personalizados de qualidade',
      text: 'A VisualGifts cria merchandising corporativo, uniformes e kits corporativos personalizados prontos a entregar a colaboradores, clientes ou parceiros.',
    },
    servicesPretitle: 'O que fazemos',
    servicesTitle: 'Merchandising e Artigos Promocionais',
    servicesSubtitle: 'Artigos personalizados sob medida com a identidade visual da sua marca.',
    services: [
      { Icon: Gift, title: 'Merchandising Promocional', desc: 'Canetas, agendas e brindes personalizados diversos.', href: '/visualgifts' },
      { Icon: Shirt, title: 'Fardamento e Têxteis', desc: 'Polos, t-shirts e vestuário técnico estampado ou bordado.', href: '/visualgifts/texteis' },
      { Icon: PackageOpen, title: 'Kits Onboarding', desc: 'Welcome packs e kits corporativos completos.', href: '/visualgifts/kits' },
    ],
    whyUsPretitle: 'Porquê a VisualGifts',
    whyUsTitle: 'Artigos Únicos e Coordenação Total',
    whyUsSubtitle: 'Garantia de impressão e entrega sintonizada.',
    whyUs: [
      { Icon: Sparkles, title: 'Fidelidade de Cores', teaser: 'Logótipo impresso com máxima fidelidade.', desc: 'Garantimos que a impressão, sublimação ou bordagem segue a paleta exata da sua identidade de marca.' },
      { Icon: Award, title: 'Materiais de Confiança', teaser: 'Qualidade que os seus parceiros vão notar.', desc: 'Selecionamos os melhores tecidos e artigos promocionais para garantir a valorização da sua marca.' },
      { Icon: PackageOpen, title: 'Preço por Quantidade', teaser: 'Condições escaláveis para grandes volumes.', desc: 'Preços altamente competitivos para encomendas volumosas ou campanhas de escala nacional.' },
      { Icon: Clock, title: 'Entrega Pronta', teaser: 'Prazo garantido para o seu evento.', desc: 'Coordenamos o fabrico e transporte para garantir que os brindes chegam a tempo do seu evento ou acção de formação.' },
    ],
    cta: {
      title: 'Deseja criar brindes personalizados?',
      subtitle: 'Partilhe o seu orçamento e objectivos e criaremos uma proposta à medida.',
      buttonLabel: 'Pedir Orçamento',
      buttonHref: '/contacto',
    },
  },
  diferencial: {
    slug: 'diferencial',
    hero: {
      title: 'O que nos torna diferentes',
      subtitle: 'Não entregamos apenas serviços — damos ao cliente as ferramentas para ganhar autonomia e reduzir custos recorrentes.',
      badges: ['Backend incluído', 'Suporte 24/7', 'Autonomia total'],
      ctaLabel: 'Falar Connosco',
      ctaHref: '/contacto',
    },
    intro: {
      title: 'Mais do que entregar, ensinamos a gerir',
      text: 'Em cada serviço, procuramos deixar o cliente mais autónomo e com menos custos recorrentes — é essa a diferença que fazemos questão de entregar.',
    },
    servicesPretitle: 'Incluído de Série',
    servicesTitle: 'Backend em Todas as Nossas Plataformas Web',
    servicesSubtitle: 'Quer o cliente peça ou não, entregamos sempre estas ferramentas junto com o site.',
    services: [
      { Icon: Mail, title: 'Envio de Emails pelo Site', desc: 'Comunique com os seus clientes directamente a partir do painel, sem ferramentas externas.', href: '/contacto' },
      { Icon: Inbox, title: 'Controlo de Emails', desc: 'Acompanhe todos os emails enviados e recebidos pela empresa, num único lugar.', href: '/contacto' },
      { Icon: Globe, title: 'Webmail Incluído', desc: 'Gestão completa da correspondência do negócio, acessível de qualquer lugar.', href: '/contacto' },
      { Icon: Workflow, title: 'Automação de Serviços', desc: 'Os nossos sites não são páginas institucionais isoladas — são sistemas de gestão.', href: '/contacto' },
    ],
    whyUsPretitle: 'Porquê Confiar em Nós',
    whyUsTitle: 'Autonomia, Poupança e Suporte Contínuo',
    whyUsSubtitle: 'O que realmente muda para quem trabalha connosco.',
    whyUs: [
      { Icon: Wallet, title: 'Menos custo de manutenção', teaser: 'O maior custo do mundo web, resolvido.', desc: 'Com o backend incluído, a manutenção do dia a dia deixa de depender de pagar a terceiros por cada pequena alteração.' },
      { Icon: LayoutDashboard, title: 'Autonomia total', teaser: 'O cliente gere o próprio site.', desc: 'O painel de administração foi pensado para ser usado pela própria empresa, sem conhecimentos técnicos avançados.' },
      { Icon: Workflow, title: 'Sistema de gestão, não só um site', teaser: 'Automação incluída de raiz.', desc: 'Cada plataforma inclui automação de processos do negócio, não apenas páginas institucionais estáticas.' },
      { Icon: Headphones, title: 'Suporte 24 horas por dia', teaser: 'Incluindo fins de semana e feriados.', desc: 'A nossa equipa está disponível a qualquer hora, porque um problema não escolhe o melhor momento para acontecer.' },
    ],
    cta: {
      title: 'Quer perceber como isto se aplica ao seu negócio?',
      subtitle: 'Fale connosco e veja como o nosso backend e suporte contínuo podem simplificar a gestão da sua empresa.',
      buttonLabel: 'Pedir Orçamento',
      buttonHref: '/contacto',
    },
  },
  cursos: {
    slug: 'cursos',
    hero: {
      title: 'Aprenda connosco ou peça consultoria',
      subtitle: 'Cursos práticos para quem quer aprender a fazer, e consultoria especializada para quem prefere ter a nossa equipa a acompanhar de perto.',
      badges: ['Cursos práticos', 'Consultoria dedicada', 'Equipa especializada'],
      ctaLabel: 'Inscrever-me',
      ctaHref: '/contacto',
    },
    intro: {
      title: 'Formação e consultoria, lado a lado',
      text: 'Se prefere aprender a fazer sozinho, temos cursos práticos. Se prefere ter a nossa equipa a tratar disso consigo, oferecemos consultoria especializada.',
    },
    servicesPretitle: 'Formação',
    servicesTitle: 'Os Nossos Cursos',
    servicesSubtitle: 'Turmas práticas, com certificado no final.',
    services: [
      { Icon: Monitor, title: 'Web Design Profissional', desc: 'Websites modernos e responsivos com as melhores práticas do mercado. 8 semanas · MZN 5.000.', href: '/contacto' },
      { Icon: Palette, title: 'Design Gráfico & Branding', desc: 'Ferramentas Adobe e criação de identidades visuais e manuais de marca. 8 semanas · MZN 4.500.', href: '/contacto' },
      { Icon: Megaphone, title: 'Marketing Digital & E-commerce', desc: 'Tráfego pago, redes sociais e lojas online de sucesso. 10 semanas · MZN 6.000.', href: '/contacto' },
    ],
    whyUsPretitle: 'Acompanhamento Especializado',
    whyUsTitle: 'Consultoria para Quem Prefere Delegar',
    whyUsSubtitle: 'A nossa equipa acompanha de perto, sem precisar de aprender a fazer sozinho.',
    whyUs: [
      { Icon: Palette, title: 'Consultoria de Marca & Design', teaser: 'Avaliação da identidade visual actual.', desc: 'Analisamos a sua marca e entregamos recomendações práticas para consistência visual em todos os pontos de contacto.' },
      { Icon: Monitor, title: 'Consultoria em Presença Digital', teaser: 'Diagnóstico do site e plataformas online.', desc: 'Avaliamos o estado actual da sua presença digital e definimos prioridades claras de melhoria.' },
      { Icon: Megaphone, title: 'Consultoria em Marketing Digital', teaser: 'Estratégia de conteúdo e tráfego pago.', desc: 'Orientação sobre posicionamento nas redes sociais, campanhas pagas e estratégia de conteúdo.' },
      { Icon: Calendar, title: 'Consultoria em Eventos', teaser: 'Planeamento especializado passo a passo.', desc: 'Acompanhamento dedicado ao planeamento de eventos corporativos, de qualquer dimensão.' },
    ],
    cta: {
      title: 'Quer aprender ou prefere delegar?',
      subtitle: 'Inscreva-se num curso ou peça uma proposta de consultoria ajustada à sua empresa.',
      buttonLabel: 'Falar Connosco',
      buttonHref: '/contacto',
    },
  },
};

export function getBrandLandingContent(slug: string): BrandLandingContent | undefined {
  return BRAND_LANDING_CONTENT[slug];
}
