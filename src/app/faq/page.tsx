'use client'

import React from 'react'
import { HelpCircle, ChevronDown } from 'lucide-react'

export default function FAQPage() {
  const faqs = [
    {
      question: "Como funciona o registo de domínios?",
      answer: "O registo de domínios é feito de forma imediata assim que o pagamento for confirmado. Terá acesso a um painel de controlo completo para gerir DNS, contactos e renovações."
    },
    {
      question: "Que métodos de pagamento aceitam?",
      answer: "Aceitamos pagamentos via M-Pesa, e-Mola, Cartão Visa/Mastercard e Transferência Bancária. Para pagamentos locais (M-Pesa/e-Mola), a ativação é automática."
    },
    {
      question: "O alojamento inclui certificados SSL grátis?",
      answer: "Sim! Todos os nossos planos de alojamento incluem certificados SSL grátis e ilimitados para todos os seus domínios e subdomínios."
    },
    {
      question: "Posso transferir o meu site para a VisualDesign?",
      answer: "Absolutamente! Oferecemos migração gratuita do seu site e emails atuais se vier de outro provedor cPanel."
    }
  ]

  return (
    <div className="min-h-screen bg-slate-50 pt-[120px] pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Perguntas Frequentes (FAQ)</h1>
          <p className="text-lg text-slate-600">Encontre respostas rápidas para as dúvidas mais comuns sobre os nossos serviços.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 flex items-center justify-between cursor-pointer">
                {faq.question}
                <ChevronDown className="w-5 h-5 text-slate-400" />
              </h3>
              <p className="text-slate-600 mt-4 leading-relaxed">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center p-8 bg-red-600 rounded-2xl text-white shadow-xl shadow-red-600/20">
          <h2 className="text-2xl font-bold mb-2">Ainda tem dúvidas?</h2>
          <p className="mb-6 opacity-90">A nossa equipa de suporte está sempre pronta para ajudar.</p>
          <a href="/contacto" className="inline-block bg-white text-red-600 font-bold px-8 py-3 rounded-lg hover:bg-slate-50 transition-colors">
            Falar com o Suporte
          </a>
        </div>
      </div>
    </div>
  )
}
