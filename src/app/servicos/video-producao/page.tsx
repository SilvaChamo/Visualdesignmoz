'use client'

import { useI18n } from '@/lib/i18n'
import { Camera, Film, Video, Play, Edit3, Mic } from 'lucide-react'

export default function VideoProducao() {
  const { t } = useI18n()

  const servicosVideo = [
    {
      icone: <Camera className="w-8 h-8" />,
      titulo: "Vídeos Institucionais",
      descricao: "Produção completa de vídeos corporativos para apresentar sua empresa",
      servicos: ["Corporate videos", "Company presentations", "Brand videos", "Internal communications", "Annual reports"]
    },
    {
      icone: <Film className="w-8 h-8" />,
      titulo: "Vídeos Comerciais",
      descricao: "Comerciais publicitários para TV, internet e redes sociais",
      servicos: ["TV commercials", "Social media ads", "Product videos", "Testimonials", "Before/after videos"]
    },
    {
      icone: <Video className="w-8 h-8" />,
      titulo: "Vídeos para Redes Sociais",
      descricao: "Conteúdo otimizado para diferentes plataformas digitais",
      servicos: ["Instagram Reels", "TikTok videos", "YouTube content", "LinkedIn videos", "Facebook content"]
    },
    {
      icone: <Play className="w-8 h-8" />,
      titulo: "Eventos e Coberturas",
      descricao: "Registro profissional de eventos, conferências e cerimônias",
      servicos: ["Event coverage", "Conferences", "Weddings", "Corporate events", "Live streaming"]
    },
    {
      icone: <Edit3 className="w-8 h-8" />,
      titulo: "Pós-produção e Edição",
      descricao: "Edição profissional, efeitos especiais e finalização",
      servicos: ["Video editing", "Color grading", "Motion graphics", "Special effects", "Audio mixing"]
    },
    {
      icone: <Mic className="w-8 h-8" />,
      titulo: "Produção de Áudio",
      descricao: "Gravação e mixagem de áudio para vídeos e podcasts",
      servicos: ["Voice over", "Podcast production", "Sound design", "Music licensing", "Audio cleaning"]
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
            <h1 className="text-3xl font-bold text-white mb-2">{t('services.video')}</h1>
            <p className="text-base text-white font-normal">
              {t('services.video.desc')}
            </p>
          </div>
        </div>
      </div>

      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">

          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicosVideo.map((servico, index) => (
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
