'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { Search, TrendingUp, FileText, Globe, BarChart3, Target, ArrowRight, CheckCircle2 } from 'lucide-react'

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
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-foreground">
      {/* Hero Section */}
      <div className="bg-[#09090b] relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">{t('services.seo')}</h1>
            <p className="text-base text-zinc-300 font-normal">
              {t('services.seo.desc')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicosSEO.map((servico, index) => (
              <div key={index} className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center mb-4">
                    <div className="text-red-500 mr-3">
                      {servico.icone}
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{servico.titulo}</h3>
                  </div>
                  
                  <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm leading-relaxed">
                    {servico.descricao}
                  </p>
                  
                  <div>
                    <h4 className="font-semibold text-zinc-700 dark:text-zinc-300 mb-3 text-sm">{t('common.included')}</h4>
                    <ul className="space-y-2">
                      {servico.servicos.map((item, idx) => (
                        <li key={idx} className="flex items-start text-zinc-600 dark:text-zinc-400 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mr-2 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Unified CTA Banner at the bottom */}
          <div className="bg-red-600 dark:bg-red-700 text-white py-16 mt-20 rounded-3xl text-center space-y-6 shadow-xl shadow-red-600/10">
            <h2 className="text-3xl font-extrabold">Quer dominar os resultados de pesquisa?</h2>
            <p className="text-lg text-red-100 max-w-xl mx-auto">
              Desenvolvemos estratégias completas de otimização on-page, técnica e local para colocar o seu site no topo do Google.
            </p>
            <Link
              href="/contacto?servico=seo"
              className="inline-flex items-center gap-2 bg-white text-red-600 font-bold px-10 py-4 rounded-xl shadow-lg hover:bg-zinc-100 transition-all transform hover:-translate-y-0.5"
            >
              <span>Pedir Orçamento Gratuito</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
