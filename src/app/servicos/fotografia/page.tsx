'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { Camera, Calendar, MapPin, Users, Heart } from 'lucide-react'

export default function Fotografia() {
  const { t } = useI18n()

  const eventosFotograficos = [
    {
      icone: <Camera className="w-8 h-8" />,
      tituloKey: 'services.photo.shoots',
      descKey: 'services.photo.shoots.desc',
      servicos: ["Book individual", "Book casal", "Book família", "Ensaios gestantes"]
    },
    {
      icone: <Calendar className="w-8 h-8" />,
      tituloKey: 'services.photo.events',
      descKey: 'services.photo.events.desc',
      servicos: ["Aniversários", "Casamentos", "Formaturas", "Eventos corporativos"]
    },
    {
      icone: <MapPin className="w-8 h-8" />,
      tituloKey: 'services.photo.travel',
      descKey: 'services.photo.travel.desc',
      servicos: ["Acompanhamento fotográfico", "Ensaios em destinos", "Documentário de viagem"]
    },
    {
      icone: <Users className="w-8 h-8" />,
      tituloKey: 'services.photo.corporate',
      descKey: 'services.photo.corporate.desc',
      servicos: ["Retratos individuais", "Fotos de equipe", "Headshots profissionais"]
    },
    {
      icone: <Heart className="w-8 h-8" />,
      tituloKey: 'services.photo.products',
      descKey: 'services.photo.products.desc',
      servicos: ["Fotos de produto", "Still life", "Catalogação completa"]
    }
  ]

  return (
    <div className="min-h-screen bg-black/10">
      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center space-x-2 text-sm">
            <Link href="/" className="text-black hover:text-red-600 transition-colors">
              {t('nav.home')}
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-black font-medium">{t('services.photography')}</span>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <h2 className="text-2xl font-bold text-black mb-8 text-center">{t('services.photo.pageTitle')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {eventosFotograficos.map((evento, index) => (
              <div key={index} className="bg-white text-black/70 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="text-red-500 mr-3">
                    {evento.icone}
                  </div>
                  <h3 className="text-xl font-bold">{t(evento.tituloKey)}</h3>
                </div>

                <p className="text-black/70 mb-6 text-sm leading-relaxed">
                  {t(evento.descKey)}
                </p>

                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-sm">{t('services.photo.included')}</h4>
                  <ul className="space-y-0">
                    {evento.servicos.map((servico, idx) => (
                      <li key={idx} className="flex items-center text-black/70 text-sm">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>
                        {servico}
                      </li>
                    ))}
                  </ul>
                </div>

                <button className="w-full bg-black text-white px-4 py-3 rounded font-medium hover:bg-red-600 hover:text-white transition-colors">
                  {t('services.photo.quote')}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <h3 className="text-xl font-bold text-black mb-4">{t('services.photo.whyTitle')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-medium text-black mb-3">{t('services.photo.equipment')}</h4>
                <p className="text-gray-600 text-sm">{t('services.photo.equipment.desc')}</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-medium text-black mb-3">{t('services.photo.experience')}</h4>
                <p className="text-gray-600 text-sm">{t('services.photo.experience.desc')}</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-medium text-black mb-3">{t('services.photo.deadline')}</h4>
                <p className="text-gray-600 text-sm">{t('services.photo.deadline.desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
