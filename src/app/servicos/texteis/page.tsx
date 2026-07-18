'use client'

import { useI18n } from '@/lib/i18n'
import { Shirt, Users, Tent, Award } from 'lucide-react'

export default function Texteis() {
  const { t } = useI18n()

  const servicosTexteis = [
    {
      icone: <Shirt className="w-8 h-8" />,
      titulo: 'Fardamento Corporativo',
      descricao: 'Uniformes personalizados para equipas e colaboradores.',
      servicos: ['Polos e t-shirts', 'Camisas corporativas', 'Coletes e jaquetas', 'Bordado e estampagem'],
    },
    {
      icone: <Tent className="w-8 h-8" />,
      titulo: 'Têxteis para Eventos',
      descricao: 'Peças personalizadas para feiras, ativações e eventos de marca.',
      servicos: ['T-shirts de evento', 'Bandanas e chapéus', 'Toalhas personalizadas', 'Bonés promocionais'],
    },
    {
      icone: <Users className="w-8 h-8" />,
      titulo: 'Equipamento Desportivo',
      descricao: 'Equipamentos para equipas desportivas patrocinadas ou internas.',
      servicos: ['Camisolas desportivas', 'Equipamento de treino', 'Personalização de nomes/números'],
    },
    {
      icone: <Award className="w-8 h-8" />,
      titulo: 'Qualidade e Durabilidade',
      descricao: 'Materiais resistentes e acabamento profissional em todas as peças.',
      servicos: ['Tecidos de qualidade', 'Impressão durável', 'Controlo de tamanhos', 'Amostras antes da produção'],
    },
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
            <h1 className="text-3xl font-bold text-white mb-2">Têxteis</h1>
            <p className="text-base text-white font-normal max-w-2xl mx-auto">
              Fardamento e têxteis personalizados para empresas e eventos.
            </p>
          </div>
        </div>
      </div>

      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicosTexteis.map((servico, index) => (
              <div key={index} className="bg-white text-black/70 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="text-red-500 mr-3">{servico.icone}</div>
                  <h3 className="text-xl font-bold">{servico.titulo}</h3>
                </div>
                <p className="text-black/70 mb-6 text-sm leading-relaxed">{servico.descricao}</p>
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
