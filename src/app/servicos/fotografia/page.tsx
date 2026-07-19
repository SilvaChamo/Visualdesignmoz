'use client'

import React, { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { Camera, Calendar, MapPin, Users, Heart, ArrowRight, CheckCircle2 } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import { BudgetRequestModal } from '@/components/forms/BudgetRequestModal'

export default function Fotografia() {
  const { t } = useI18n()
  const [isModalOpen, setIsModalOpen] = useState(false)

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
      <NotchSection shape="start" bg="bg-[#09090b]" first>
        <div className="relative overflow-hidden pt-[180px] pb-[100px]">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10" style={{ backgroundImage: "url('/assets/BG.jpg')" }} />
          <div className="absolute inset-0 bg-black/55" />
          <div className="container mx-auto max-w-7xl px-6 relative z-10 text-center">
            <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">{t('services.photo.pageTitle')}</h1>
            <p className="text-lg text-zinc-300 font-normal max-w-2xl mx-auto">{t('services.photo.shoots.desc')}</p>
          </div>
        </div>
      </NotchSection>

      {/* Services Grid Section */}
      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-20">
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
          </div>
        </div>
      </NotchSection>

      {/* Why Choose Us Section */}
      <NotchSection shape="mid" bg="bg-white dark:bg-zinc-900">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6 text-center">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-12">{t('services.photo.whyTitle')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 p-8 rounded-2xl">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('services.photo.equipment')}</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{t('services.photo.equipment.desc')}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-95: border border-zinc-200/80 dark:border-zinc-800 p-8 rounded-2xl">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('services.photo.experience')}</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{t('services.photo.experience.desc')}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-95: border border-zinc-200/80 dark:border-zinc-800 p-8 rounded-2xl">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">{t('services.photo.deadline')}</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{t('services.photo.deadline.desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </NotchSection>

      {/* CTA Banner Section */}
      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6">
            <div className="bg-red-600 dark:bg-red-700 text-white py-16 rounded-[2.5rem] text-center space-y-6 shadow-xl shadow-red-600/10 relative overflow-hidden">
              <h2 className="text-3xl font-extrabold">Precisa de uma sessão fotográfica ou cobertura?</h2>
              <p className="text-lg text-red-100 max-w-xl mx-auto">
                Sessões corporativas, casamentos, eventos ou fotografia de produto profissional com equipamentos de ponta.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 bg-white hover:bg-zinc-100 text-red-600 font-extrabold px-10 py-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Pedir Orçamento Gratuito</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </NotchSection>

      {/* Budget Modal */}
      <BudgetRequestModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialService="fotografia"
      />

    </div>
  )
}
