'use client'

import { useI18n } from '@/lib/i18n'
import { Search, TrendingUp, FileText, Globe, BarChart3, Target } from 'lucide-react'

export default function SEO() {
  const { t } = useI18n()

  const servicosSEO = [
    {
      icone: <Search className="w-8 h-8" />,
      titulo: "SEO On-Page",
      descricao: "Otimização completa de todas as páginas do seu site para buscadores",
      servicos: ["Meta tags", "URLs amigáveis", "Header tags", "Content optimization", "Image SEO"]
    },
    {
      icone: <TrendingUp className="w-8 h-8" />,
      titulo: "SEO Técnico",
      descricao: "Resolução de problemas técnicos que afetam o ranking",
      servicos: ["Site speed", "Mobile optimization", "Schema markup", "XML sitemaps", "Robots.txt"]
    },
    {
      icone: <FileText className="w-8 h-8" />,
      titulo: "SEO de Conteúdo",
      descricao: "Criação e otimização de conteúdo para ranking orgânico",
      servicos: ["Keyword research", "Content strategy", "Blog posts", "Landing pages", "Content audit"]
    },
    {
      icone: <Globe className="w-8 h-8" />,
      titulo: "SEO Local",
      descricao: "Otimização para aparecer em buscas locais e Google Maps",
      servicos: ["Google Business Profile", "Local citations", "Reviews management", "Local keywords", "Geotagging"]
    },
    {
      icone: <BarChart3 className="w-8 h-8" />,
      titulo: "Link Building",
      descricao: "Construção estratégica de autoridade através de links de qualidade",
      servicos: ["Guest posting", "Directory submissions", "Broken link building", "Resource pages", "Outreach"]
    },
    {
      icone: <Target className="w-8 h-8" />,
      titulo: "Análise e Relatórios",
      descricao: "Monitoramento completo de performance e estratégias de melhoria",
      servicos: ["Ranking tracking", "Traffic analysis", "Competitor analysis", "Monthly reports", "ROI measurement"]
    }
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-[#404040] relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">{t('services.seo')}</h1>
            <p className="text-base text-white font-normal">
              {t('services.seo.desc')}
            </p>
          </div>
        </div>
      </div>

      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">

          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicosSEO.map((servico, index) => (
              <div key={index} className="bg-white text-black/70 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="text-red-500 mr-3">
                    {servico.icone}
                  </div>
                  <h3 className="text-xl font-bold">{servico.titulo}</h3>
                </div>
                
                <p className="text-black/70 mb-6 text-sm leading-relaxed">
                  {servico.descricao}
                </p>
                
                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-sm">{t('common.included')}</h4>
                  <ul className="space-y-0">
                    {servico.servicos.map((item, idx) => (
                      <li key={idx} className="flex items-center text-black/70 text-sm">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <button className="w-fit bg-black text-white px-4 py-3 rounded font-medium hover:bg-red-600 hover:text-white transition-colors">
                  {t('common.requestQuote')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
