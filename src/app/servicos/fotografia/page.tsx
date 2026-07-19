'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { Camera, Calendar, MapPin, Users, Heart, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function Fotografia() {
  const { t } = useI18n()

  const eventosFotograficos = [
    { icone: <Camera className="w-8 h-8" />, tituloKey: 'services.photo.shoots', descKey: 'services.photo.shoots.desc', servicos: ["Book individual", "Book casal", "Book família", "Ensaios gestantes"] },
    { icone: <Calendar className="w-8 h-8" />, tituloKey: 'services.photo.events', descKey: 'services.photo.events.desc', servicos: ["Aniversários", "Casamentos", "Formaturas", "Eventos corporativos"] },
    { icone: <MapPin className="w-8 h-8" />, tituloKey: 'services.photo.travel', descKey: 'services.photo.travel.desc', servicos: ["Acompanhamento fotográfico", "Ensaios em destinos", "Documentário de viagem"] },
    { icone: <Users className="w-8 h-8" />, tituloKey: 'services.photo.corporate', descKey: 'services.photo.corporate.desc', servicos: ["Retratos individuais", "Fotos de equipe", "Headshots profissionais"] },
    { icone: <Heart className="w-8 h-8" />, tituloKey: 'services.photo.products', descKey: 'services.photo.products.desc', servicos: ["Fotos de produto", "Still life", "Catalogação completa"] }
  ]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-foreground">
      {/* Hero Section */}
      <div className="bg-[#09090b] relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10" style={{ backgroundImage: "url('/assets/BG.jpg')" }} />
        <div className="absolute inset-0 bg-black/55" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">{t('services.photo.pageTitle')}</h1>
            <p className="text-base text-zinc-300 font-normal">{t('services.photo.shoots.desc')}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {eventosFotograficos.map((evento, index) => (
              <div key={index} className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center mb-4">
                    <div className="text-red-500 mr-3">{evento.icone}</div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t(evento.tituloKey)}</h3>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm leading-relaxed">{t(evento.descKey)}</p>
                  <div>
                    <h4 className="font-semibold text-zinc-700 dark:text-zinc-300 mb-3 text-sm">{t('services.photo.included') || 'Incluído:'}</h4>
                    <ul className="space-y-2">
                      {evento.servicos.map((servico, idx) => (
                        <li key={idx} className="flex items-start text-zinc-600 dark:text-zinc-400 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mr-2 mt-0.5" />
                          <span>{servico}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Why Choose Us */}
          <div className="mt-20 text-center">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-10">{t('services.photo.whyTitle')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('services.photo.equipment')}</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{t('services.photo.equipment.desc')}</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('services.photo.experience')}</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{t('services.photo.experience.desc')}</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('services.photo.deadline')}</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{t('services.photo.deadline.desc')}</p>
              </div>
            </div>
          </div>

          {/* Unified CTA Banner at the bottom */}
          <div className="bg-red-600 dark:bg-red-700 text-white py-16 mt-20 rounded-3xl text-center space-y-6 shadow-xl shadow-red-600/10">
            <h2 className="text-3xl font-extrabold">Precisa de uma sessão fotográfica ou cobertura?</h2>
            <p className="text-lg text-red-100 max-w-xl mx-auto">
              Sessões corporativas, casamentos, eventos ou fotografia de produto profissional com equipamentos de ponta.
            </p>
            <Link
              href="/contacto?servico=fotografia"
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
