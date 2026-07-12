'use client'

import Link from 'next/link'

const servicosWeb = [
  {
    id: 'web-design',
    title: 'Web Design',
    description: 'Desenvolvimento de websites modernos, institucionais e landing pages responsivos, aplicativos moveis e sistemas de gestão, adaptadas ao seu negócio',
    link: '/servicos/webdesign'
  },
  {
    id: 'sistemas',
    title: 'Aplicações & Sistemas de Gestão',
    description: 'Desenvolvimento de aplicações web personalizadas, plataformas SaaS e sistemas para automação de processos internos.',
    link: '/servicos/webdesign'
  },
  {
    id: 'seo',
    title: 'Otimização para Buscadores (SEO)',
    description: 'Engenharia de posicionamento orgânico e auditoria técnica para colocar o seu site no topo dos resultados de pesquisa.',
    link: '/servicos/seo'
  },
  {
    id: 'redes-sociais',
    title: 'Gestão de Redes Sociais',
    description: 'Fazemos Gestão de tráfego do seu site, fortificamos a sua presença digital e criamos estratégias de engajamento integradas aos canais digitais.',
    link: '/servicos/redes-sociais'
  }
]

export default function GridServicosWeb() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
      {servicosWeb.map((servico) => (
        <div
          key={servico.id}
          className="bg-white dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/15 text-black/70 dark:text-zinc-100 p-3 sm:p-4 rounded-lg flex flex-col justify-between"
        >
          <div>
            <h4 className="font-bold mb-2">{servico.title}</h4>
            <p className="text-black/70 dark:text-zinc-300 text-sm mb-[20px]">{servico.description}</p>
          </div>
          <Link
            href={servico.link}
            className="bg-black text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium hover:bg-red-600 hover:text-white dark:bg-transparent dark:border dark:border-white/25 dark:text-white dark:hover:bg-red-600 dark:hover:border-red-600 transition-colors inline-block cursor-pointer self-start"
          >
            Ver Serviços
          </Link>
        </div>
      ))}

      <div className="col-span-full mt-2 p-4 sm:p-6 bg-white dark:bg-white/10 dark:border dark:border-white/15 rounded-lg border border-dashed border-black/20 text-center">
        <p className="text-black/70 dark:text-zinc-300 text-sm">
          Procura soluções de identidade visual, fotografia ou vídeo?{' '}
          <Link href="/servicos" className="text-red-600 dark:text-red-400 font-medium underline hover:text-red-700 transition-colors">
            Aceda à nossa divisão de Design Criativo
          </Link>
        </p>
      </div>
    </div>
  )
}
