'use client'

import { useI18n } from '@/lib/i18n'
import { Route, Users, Package, Clock } from 'lucide-react'

export default function Mobilidade() {
  const { t } = useI18n()

  const servicosMobilidade = [
    {
      icone: <Users className="w-8 h-8" />,
      titulo: 'Transferes de Pessoas',
      descricao: 'Transporte executivo e transferes para colaboradores, clientes e convidados.',
      servicos: ['Transfere aeroporto', 'Transporte executivo', 'Transporte para eventos', 'Rotas corporativas fixas'],
    },
    {
      icone: <Package className="w-8 h-8" />,
      titulo: 'Logística de Mercadorias',
      descricao: 'Transporte e distribuição de mercadorias entre pontos definidos.',
      servicos: ['Recolha e entrega', 'Distribuição local', 'Gestão de rotas', 'Acompanhamento de carga'],
    },
    {
      icone: <Route className="w-8 h-8" />,
      titulo: 'Planeamento de Rotas',
      descricao: 'Optimização de trajetos para reduzir custos e tempo de deslocação.',
      servicos: ['Análise de rotas', 'Optimização de frota', 'Relatórios de utilização'],
    },
    {
      icone: <Clock className="w-8 h-8" />,
      titulo: 'Disponibilidade Flexível',
      descricao: 'Serviços pontuais ou contratos de mobilidade contínuos, à medida do negócio.',
      servicos: ['Serviço pontual', 'Contrato mensal', 'Disponibilidade 24/7', 'Suporte dedicado'],
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
            <h1 className="text-3xl font-bold text-white mb-2">Serviços de Mobilidade</h1>
            <p className="text-base text-white font-normal max-w-2xl mx-auto">
              Logística e transferes fiáveis para pessoas e mercadorias.
            </p>
          </div>
        </div>
      </div>

      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicosMobilidade.map((servico, index) => (
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
