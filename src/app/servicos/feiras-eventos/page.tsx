'use client'

import { useI18n } from '@/lib/i18n'
import { Tent, Calendar, Megaphone, Camera, MapPin, Users } from 'lucide-react'

export default function FeirasEventos() {
  const { t } = useI18n()

  const servicosEventos = [
    { icone: <Tent className="w-8 h-8" />, titulo: "Design de Stands", descricao: "Projeto e montagem de stands para feiras e exposições com impacto visual", servicos: ["Projeto 3D", "Materiais premium", "Montagem e desmontagem", "Iluminação especial", "Personalização total"] },
    { icone: <Calendar className="w-8 h-8" />, titulo: "Organização de Eventos", descricao: "Planeamento e gestão completa de eventos corporativos e sociais", servicos: ["Planeamento estratégico", "Gestão de fornecedores", "Logística completa", "Cronograma detalhado", "Coordenação no dia"] },
    { icone: <Megaphone className="w-8 h-8" />, titulo: "Materiais Promocionais", descricao: "Criação de todo o material gráfico e promocional para o seu evento", servicos: ["Banners e rollups", "Flyers e convites", "Brindes personalizados", "Merchandising", "Sinalética"] },
    { icone: <Camera className="w-8 h-8" />, titulo: "Cobertura do Evento", descricao: "Registo fotográfico e audiovisual profissional do seu evento", servicos: ["Fotografia profissional", "Vídeo de cobertura", "Drone footage", "Live streaming", "Edição e entrega rápida"] },
    { icone: <MapPin className="w-8 h-8" />, titulo: "Cenografia e Decoração", descricao: "Ambientação e decoração temática para criar experiências memoráveis", servicos: ["Cenografia criativa", "Decoração temática", "Flores e arranjos", "Mobiliário especial", "Efeitos visuais"] },
    { icone: <Users className="w-8 h-8" />, titulo: "Ativações de Marca", descricao: "Experiências interativas para promover a sua marca em eventos", servicos: ["Brand activation", "Experiências interativas", "Sampling e degustação", "Photobooth branded", "Gamificação"] }
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-[#404040] relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20" style={{ backgroundImage: "url('/assets/BG.jpg')" }} />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Feiras e Eventos</h1>
            <p className="text-base text-white font-normal">Stands, materiais e cobertura completa para o seu evento</p>
          </div>
        </div>
      </div>
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicosEventos.map((s, i) => (
              <div key={i} className="bg-white text-black/70 p-6 rounded-lg">
                <div className="flex items-center mb-4"><div className="text-red-500 mr-3">{s.icone}</div><h3 className="text-xl font-bold">{s.titulo}</h3></div>
                <p className="text-black/70 mb-6 text-sm leading-relaxed">{s.descricao}</p>
                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-sm">O que inclui:</h4>
                  <ul className="space-y-0">{s.servicos.map((item, idx) => (<li key={idx} className="flex items-center text-black/70 text-sm"><span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>{item}</li>))}</ul>
                </div>
                <button className="w-full bg-black text-white px-4 py-3 rounded font-medium hover:bg-red-600 transition-colors">Solicitar Orçamento</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
