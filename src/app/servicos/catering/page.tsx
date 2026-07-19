'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { Coffee, ArrowRight, CheckCircle2, Award, Sparkles, ChefHat } from 'lucide-react'

export default function Catering() {
  const { t } = useI18n()

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
      <div className="bg-[#09090b] relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Serviço de Catering Profissional</h1>
            <p className="text-base text-zinc-300 font-normal">
              Catering completo e personalizado para os seus eventos corporativos e sociais
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-16">
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

          {/* Process Section */}
          <div className="mt-20 text-center">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-10">O Nosso Processo</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl">
                <span className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-extrabold text-lg flex items-center justify-center mx-auto mb-4">1</span>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">Definição do Menu</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">Alinhamos os gostos, o tipo de público e o formato do evento para desenhar o menu perfeito.</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl">
                <span className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-extrabold text-lg flex items-center justify-center mx-auto mb-4">2</span>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">Preparação e Logística</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">Cuidamos da frescura dos ingredientes e da logística para que tudo chegue impecável.</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-2xl">
                <span className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-extrabold text-lg flex items-center justify-center mx-auto mb-4">3</span>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">Serviço no Local</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">A nossa equipa garante uma montagem primorosa e serviço profissional durante todo o evento.</p>
              </div>
            </div>
          </div>

          {/* Unified CTA Banner at the bottom */}
          <div className="bg-red-600 dark:bg-red-700 text-white py-16 mt-20 rounded-3xl text-center space-y-6 shadow-xl shadow-red-600/10">
            <h2 className="text-3xl font-extrabold">Quer proporcionar uma experiência gastronómica memorável?</h2>
            <p className="text-lg text-red-100 max-w-xl mx-auto">
              Seja um evento corporativo de grande escala ou uma comemoração privada, a nossa equipa entrega excelência e requinte.
            </p>
            <Link
              href="/contacto?servico=catering"
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
