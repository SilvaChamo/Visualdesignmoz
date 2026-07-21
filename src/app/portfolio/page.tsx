'use client'

import { useI18n } from '@/lib/i18n'
import Image from 'next/image'

export default function PortfolioPage() {
  const { t } = useI18n()

  const projects = [
    {
      title: "E-commerce Doce Momento",
      category: "Web Design / E-commerce",
      desc: "Desenvolvimento de uma loja online completa para venda de doces e salgados, com integração de pagamentos M-Pesa.",
      image: "/assets/Doce-Xl1w27CrpQiIGFCVayQWAQ.jpg",
      tags: ["Next.js", "Tailwind CSS", "M-Pesa"]
    },
    {
      title: "Identidade Visual MLT Mark",
      category: "Design Gráfico / Branding",
      desc: "Criação de logotipo, manual de marca e materiais estacionários para uma empresa de consultoria.",
      image: "/assets/mltmark-yz7SQt6lzOCz3rdLcBegBg.jpg",
      tags: ["Branding", "Illustrator", "Corporate"]
    },
    {
      title: "Portal Corporativo VisualDesign",
      category: "Web Design / UI/UX",
      desc: "Redesign completo do portal institucional da nossa agência, focado em conversão e experiência do utilizador.",
      image: "/assets/Portfolio-FqaDr0sCVpVxSNTK9HoooA.jpg",
      tags: ["UI/UX", "Web Design", "SEO"]
    }
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Hero Section Standardized */}
      <div className="bg-[#404040] relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <div className="text-xs sm:text-sm text-zinc-400 font-bold uppercase tracking-widest mb-2">
              Início / Portefólio
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{t('portfolio.title')}</h1>
            <p className="text-base text-white font-normal max-w-2xl mx-auto">
              {t('portfolio.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Projects Content */}
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project, index) => (
              <div key={index} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className="relative h-56 w-full bg-slate-200">
                    <Image
                      src={project.image}
                      alt={project.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <span className="text-red-600 text-xs font-bold uppercase tracking-wider">{project.category}</span>
                    <h3 className="text-xl font-bold text-slate-900 mt-1 mb-2">{project.title}</h3>
                    <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                      {project.desc}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {project.tags.map((tag, idx) => (
                        <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="p-6 pt-0">
                  <button className="w-fit bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors self-start">
                    Ver Projecto
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
