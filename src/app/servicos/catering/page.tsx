'use client'

import React, { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { Coffee, ArrowRight, CheckCircle2, Award, Sparkles, ChefHat } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import { BudgetRequestModal } from '@/components/forms/BudgetRequestModal'

export default function Catering() {
  const { t } = useI18n()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const cateringFeatures = [
    {
      icone: <ChefHat className="w-8 h-8" />,
      titulo: "Menus Personalizados",
      descricao: "Elaboramos propostas gastronómicas adaptadas às necessidades do seu evento e restrições alimentares.",
      itens: ["Pratos quentes e frios", "Opções vegetarianas/veganas", "Sobremesas artesanais", "Bebidas e cocktails"]
    },
    {
      icone: <Coffee className="w-8 h-8" />,
      titulo: "Coffee Breaks & Brunch",
      descricao: "Serviço ideal para reuniões corporativas, conferências ou eventos matinais informais.",
      itens: ["Pastelaria fina", "Salgados tradicionais", "Cafés e sumos naturais", "Montagem elegante"]
    },
    {
      icone: <Award className="w-8 h-8" />,
      titulo: "Banquetes & Gala",
      descricao: "Serviço de alta gastronomia com empratamento cuidado e equipa de sala profissional.",
      itens: ["Jantares de gala", "Casamentos e baptizados", "Serviço de mesa completo", "Decoração incluída"]
    },
    {
      icone: <Sparkles className="w-8 h-8" />,
      titulo: "Cocktails & Finger Food",
      descricao: "Alimentação ligeira e sofisticada, perfeita para networking e eventos corporativos dinâmicos.",
      itens: ["Canapés gourmet", "Miniaturas salgadas", "Show cooking", "Serviço volante"]
    }
  ]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-foreground">
      
      {/* Hero Section */}
      <NotchSection shape="start" bg="bg-[#09090b]" first>
        <div className="relative overflow-hidden pt-[180px] pb-[100px]">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10"
            style={{ backgroundImage: "url('/assets/BG.jpg')" }}
          />
          <div className="absolute inset-0 bg-black/55" />
          <div className="container mx-auto max-w-7xl px-6 relative z-10 text-center">
            <h1 className="text-4xl font-extrabold text-white mb-2">Serviço de Catering Profissional</h1>
            <p className="text-lg text-zinc-300 font-normal max-w-2xl mx-auto">
              Catering completo e personalizado para os seus eventos corporativos e sociais
            </p>
          </div>
        </div>
      </NotchSection>

      {/* Services Grid Section */}
      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {cateringFeatures.map((servico, index) => (
                <div key={index} className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center mb-4">
                      <div className="text-red-500 mr-3">
                        {servico.icone}
                      </div>
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{servico.titulo}</h3>
                    </div>
                    
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm leading-relaxed">
                      {servico.descricao}
                    </p>
                    
                    <div>
                      <h4 className="font-semibold text-zinc-700 dark:text-zinc-300 mb-3 text-sm">O que oferecemos:</h4>
                      <ul className="space-y-2">
                        {servico.itens.map((item, idx) => (
                          <li key={idx} className="flex items-start text-zinc-600 dark:text-zinc-400 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mr-2 mt-0.5" />
                            <span>{item}</span>
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

      {/* Process Section */}
      <NotchSection shape="mid" bg="bg-white dark:bg-zinc-900">
        <div className="py-20">
          <div className="container mx-auto max-w-7xl px-6 text-center">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-12">O Nosso Processo</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 p-8 rounded-2xl">
                <span className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-black text-xl flex items-center justify-center mx-auto mb-4">1</span>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">Definição do Menu</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">Alinhamos os gostos, o tipo de público e o formato do evento para desenhar o menu perfeito.</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 p-8 rounded-2xl">
                <span className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-black text-xl flex items-center justify-center mx-auto mb-4">2</span>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">Preparação e Logística</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">Cuidamos da frescura dos ingredientes e da logística para que tudo chegue impecável.</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 p-8 rounded-2xl">
                <span className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-black text-xl flex items-center justify-center mx-auto mb-4">3</span>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">Serviço no Local</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">A nossa equipa garante uma montagem primorosa e serviço profissional durante todo o evento.</p>
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
              <h2 className="text-3xl font-extrabold">Quer proporcionar uma experiência gastronómica memorável?</h2>
              <p className="text-lg text-red-100 max-w-xl mx-auto">
                Seja um evento corporativo de grande escala ou uma comemoração privada, a nossa equipa entrega excelência e requinte.
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
        initialService="catering"
      />

    </div>
  )
}
