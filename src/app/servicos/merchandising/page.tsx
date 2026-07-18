'use client'

import { useI18n } from '@/lib/i18n'
import { Gift, Pen, Coffee, Briefcase } from 'lucide-react'

export default function Merchandising() {
  const { t } = useI18n()

  const servicosMerchandising = [
    {
      icone: <Pen className="w-8 h-8" />,
      titulo: 'Artigos de Escritório',
      descricao: 'Canetas, blocos, cadernos e acessórios de secretária personalizados.',
      servicos: ['Canetas personalizadas', 'Blocos e cadernos', 'Pastas e capas', 'Acessórios de secretária'],
    },
    {
      icone: <Coffee className="w-8 h-8" />,
      titulo: 'Brindes Corporativos',
      descricao: 'Canecas, garrafas e artigos do dia-a-dia com a sua marca.',
      servicos: ['Canecas personalizadas', 'Garrafas e copos térmicos', 'Powerbanks e gadgets', 'Sacos e mochilas'],
    },
    {
      icone: <Gift className="w-8 h-8" />,
      titulo: 'Brindes de Evento',
      descricao: 'Merchandising pensado para feiras, conferências e lançamentos.',
      servicos: ['Kits para participantes', 'Brindes de stand', 'Artigos promocionais', 'Embalagens personalizadas'],
    },
    {
      icone: <Briefcase className="w-8 h-8" />,
      titulo: 'Programas Corporativos',
      descricao: 'Fornecimento contínuo de merchandising para campanhas e fidelização.',
      servicos: ['Gestão de stock', 'Encomendas recorrentes', 'Distribuição', 'Consultoria de brindes'],
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
            <h1 className="text-3xl font-bold text-white mb-2">Merchandising</h1>
            <p className="text-base text-white font-normal max-w-2xl mx-auto">
              Brindes e artigos promocionais que levam a sua marca para todo o lado.
            </p>
          </div>
        </div>
      </div>

      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicosMerchandising.map((servico, index) => (
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
