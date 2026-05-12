'use client'

import { useI18n } from '@/lib/i18n'
import Image from 'next/image'

export default function AboutPage() {
  const { t } = useI18n()

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
            <h1 className="text-3xl font-bold text-white mb-2">{t('about.title')}</h1>
            <p className="text-base text-white font-normal max-w-2xl mx-auto">
              {t('about.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* About Content */}
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center bg-white p-8 rounded-2xl shadow-sm">
            <div>
              <span className="text-red-600 text-sm font-bold uppercase tracking-wider">A Nossa História</span>
              <h2 className="text-3xl font-bold text-slate-900 mt-2 mb-6">
                Criando Soluções Digitais <span className="text-red-600">Inovadoras</span>
              </h2>
              <p className="text-slate-600 mb-6 leading-relaxed">
                Fundada com a visão de transformar o panorama digital em Moçambique, a VisualDesign tem sido líder em inovação, criatividade e excelência técnica. A nossa jornada começou com uma pequena equipa de apaixonados por design e tecnologia, e hoje orgulhamo-nos de ser uma referência no mercado.
              </p>
              <p className="text-slate-600 mb-6 leading-relaxed">
                Acreditamos que cada projeto é único e merece uma abordagem personalizada. Desde o desenvolvimento de websites corporativos até à gestão de campanhas de marketing complexas, a nossa equipa dedica-se a entregar resultados que superam as expectativas.
              </p>
              <p className="text-slate-600 leading-relaxed">
                O nosso compromisso é com o seu sucesso. Continuamos a investir em novas tecnologias e na formação da nossa equipa para garantir que a sua marca esteja sempre um passo à frente no mundo digital.
              </p>
            </div>

            <div className="relative h-[400px] rounded-xl overflow-hidden shadow-lg">
              <Image
                src="/assets/Corporate-NWWHx4FI100tNSGFKtY_DA.jpg"
                alt="Equipa VisualDesign"
                fill
                className="object-cover"
              />
            </div>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
            <div className="bg-white p-6 rounded-xl shadow-sm text-center border border-slate-100">
              <div className="text-4xl font-bold text-red-600 mb-2">50+</div>
              <div className="text-slate-600 text-sm font-medium">Projetos Concluídos</div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm text-center border border-slate-100">
              <div className="text-4xl font-bold text-red-600 mb-2">30+</div>
              <div className="text-slate-600 text-sm font-medium">Clientes Satisfeitos</div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm text-center border border-slate-100">
              <div className="text-4xl font-bold text-red-600 mb-2">4+</div>
              <div className="text-slate-600 text-sm font-medium">Anos de Experiência</div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm text-center border border-slate-100">
              <div className="text-4xl font-bold text-red-600 mb-2">100%</div>
              <div className="text-slate-600 text-sm font-medium">Dedicação</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
