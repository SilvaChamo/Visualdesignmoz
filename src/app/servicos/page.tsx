'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { Monitor, Palette, Megaphone, Shield, Server, Mail, HeadphonesIcon, Tent } from 'lucide-react'

export default function ServicesPage() {
  const { t } = useI18n()

  const mainServices = [
    { icon: <Monitor className="w-8 h-8" />, title: t('services.web'), desc: "Desenvolvimento de websites profissionais, responsivos e otimizados para motores de busca.", link: "/servicos/webdesign" },
    { icon: <Palette className="w-8 h-8" />, title: t('services.graphic'), desc: "Identidade visual, branding, materiais promocionais e design para redes sociais.", link: "/servicos/design-grafico" },
    { icon: <Megaphone className="w-8 h-8" />, title: t('services.marketing'), desc: "Gestão de redes sociais, campanhas de tráfego pago e estratégias de SEO.", link: "/servicos/marketing-digital" },
    { icon: <Server className="w-8 h-8" />, title: "Alojamento Web", desc: "Servidores rápidos, seguros e com suporte 24/7 para o seu website.", link: "/servicos/hospedagem" },
    { icon: <Shield className="w-8 h-8" />, title: "Certificados SSL", desc: "Proteja o seu site e os dados dos seus clientes com certificados SSL.", link: "/servicos/ssl" },
    { icon: <Mail className="w-8 h-8" />, title: "Email Profissional", desc: "Comunique com profissionalismo usando contas de email com o seu domínio.", link: "/servicos/email" },
    { icon: <HeadphonesIcon className="w-8 h-8" />, title: "Suporte Técnico", desc: "Assistência técnica e manutenção contínua para os seus serviços digitais.", link: "/servicos/suporte" },
    { icon: <Tent className="w-8 h-8" />, title: "Feiras e Eventos", desc: "Design de stands, materiais promocionais e cobertura completa para eventos.", link: "/servicos/feiras-eventos" }
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Hero Section Standardized */}
      <div className="bg-[#404040] relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">{t('nav.services')}</h1>
            <p className="text-base text-white font-normal max-w-2xl mx-auto">
              Soluções digitais completas para impulsionar o seu negócio
            </p>
          </div>
        </div>
      </div>

      {/* Services Content */}
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {mainServices.map((service, index) => (
              <div key={index} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center text-red-600 mb-6">
                    {service.icon}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{service.title}</h3>
                  <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                    {service.desc}
                  </p>
                </div>
                
                <Link 
                  href={service.link} 
                  className="w-fit bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors self-start"
                >
                  Saber Mais
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
