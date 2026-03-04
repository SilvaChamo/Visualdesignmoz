'use client'

import React from 'react'
import {
    Globe,
    Server,
    ShieldCheck,
    Mail,
    Star,
    TrendingUp,
    ArrowRight,
    Sparkles,
    Contact,
    LifeBuoy
} from 'lucide-react'
import Link from 'next/link'


const services = [
    {
        id: 'domains',
        title: 'Domínios .MZ',
        description: 'Garanta sua identidade online com extensões nacionais e internacionais com registro imediato.',
        icon: <Globe className="w-8 h-8" />,
        color: 'blue',
        link: '/servicos/dominios',
        price: 'Desde 1.250 MT/ano'
    },
    {
        id: 'hosting',
        title: 'Hospedagem Web',
        description: 'Alta performance para seu site ou aplicação com servidores ultra-rápidos em Moçambique.',
        icon: <Server className="w-8 h-8" />,
        color: 'green',
        link: '/servicos/hospedagem',
        price: 'Desde 2.500 MT/ano'
    },
    {
        id: 'ssl',
        title: 'Certificados SSL',
        description: 'Segurança máxima e selo de confiança para seus visitantes com criptografia de 256 bits.',
        icon: <ShieldCheck className="w-8 h-8" />,
        color: 'amber',
        link: '/servicos/ssl',
        price: 'Desde 1.500 MT/ano'
    },
    {
        id: 'email',
        title: 'Email Profissional',
        description: 'Comunicação corporativa segura e personalizada com seu próprio domínio e anti-spam.',
        icon: <Mail className="w-8 h-8" />,
        color: 'purple',
        link: '/servicos/email',
        price: 'Desde 500 MT/mês'
    },
    {
        id: 'design',
        title: 'Design Gráfico',
        description: 'Criação de logotipos, material para redes sociais e identidade visual de alto impacto.',
        icon: <Star className="w-8 h-8" />,
        color: 'red',
        link: '/servicos/design-grafico',
        price: 'Sob Consulta'
    },
    {
        id: 'marketing',
        title: 'Marketing Digital',
        description: 'Estratégias avançadas para aumentar suas vendas e presença online nos canais certos.',
        icon: <TrendingUp className="w-8 h-8" />,
        color: 'orange',
        link: '/servicos/marketing-digital',
        price: 'Sob Consulta'
    },
    {
        id: 'digital-card',
        title: 'Cartão Digital',
        description: 'O seu cartão de visita moderno e interativo, sempre acessível no telemóvel dos seus clientes.',
        icon: <Contact className="w-8 h-8" />,
        color: 'indigo',
        link: '/servicos/cartao-digital',
        price: '2.500 MT (Pagamento Único)'
    },
    {
        id: 'support',
        title: 'Suporte Prioritário',
        description: 'Acesso direto a técnicos especialistas para resolver qualquer dúvida ou problema urgente.',
        icon: <LifeBuoy className="w-8 h-8" />,
        color: 'rose',
        link: '/servicos/suporte',
        price: 'Incluído nos Planos Business'
    }
]

export default function MarketplacePage() {
    return (
        <div className="space-y-10 pb-20">
            {/* Header Section */}
            <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 to-black rounded-[40px] p-10 lg:p-16 text-white shadow-2xl">
                <div className="absolute top-0 right-0 p-16 opacity-10 blur-2xl bg-red-600 rounded-full -mr-20 -mt-20 w-80 h-80 animate-pulse" />
                <div className="relative z-10 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-600/20 text-red-500 border border-red-500/20 text-xs font-black uppercase tracking-widest mb-6">
                        <Sparkles className="w-4 h-4" />
                        Loja de Serviços
                    </div>
                    <h1 className="text-4xl lg:text-6xl font-black mb-6 tracking-tighter leading-none">
                        Expanda a sua <span className="text-red-600">Presença Digital</span>
                    </h1>
                    <p className="text-gray-400 text-lg lg:text-xl font-medium leading-relaxed">
                        Descubra serviços premium desenhados para elevar o seu negócio ao próximo nível.
                        Mais do que tecnologia, entregamos resultados.
                    </p>
                </div>
            </div>

            {/* Services Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
                {services.map((service, index) => (
                    <div
                        key={service.id}
                    >
                        <Link
                            href={service.link}
                            className="group h-full bg-white rounded-3xl border border-gray-100 p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col relative overflow-hidden"
                        >
                            {/* Decorative background icon */}
                            <div className="absolute top-6 right-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity group-hover:scale-125 transition-transform duration-500 text-black">
                                {service.icon}
                            </div>

                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors shadow-sm
                ${service.color === 'blue' ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-600' :
                                    service.color === 'green' ? 'bg-green-50 text-green-600 group-hover:bg-green-600' :
                                        service.color === 'amber' ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-600' :
                                            service.color === 'purple' ? 'bg-purple-50 text-purple-600 group-hover:bg-purple-600' :
                                                service.color === 'red' ? 'bg-red-50 text-red-600 group-hover:bg-red-600' :
                                                    service.color === 'orange' ? 'bg-orange-50 text-orange-600 group-hover:bg-orange-600' :
                                                        service.color === 'indigo' ? 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600' :
                                                            'bg-rose-50 text-rose-600 group-hover:bg-rose-600'
                                } group-hover:text-white transition-all duration-300`}
                            >
                                {service.icon}
                            </div>

                            <h3 className="text-xl font-black text-gray-900 mb-3 tracking-tight group-hover:text-red-600 transition-colors">
                                {service.title}
                            </h3>

                            <p className="text-gray-500 text-sm font-medium leading-relaxed mb-6 flex-1">
                                {service.description}
                            </p>

                            <div className="pt-6 border-t border-gray-50 flex items-center justify-between mt-auto">
                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest leading-none">
                                    {service.price}
                                </span>
                                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-red-600 group-hover:text-white transition-all transform group-hover:translate-x-1 shadow-sm">
                                    <ArrowRight className="w-4 h-4" />
                                </div>
                            </div>
                        </Link>
                    </div>
                ))}
            </div>

            {/* Special Offer / Support Row */}
            <div className="bg-white rounded-[32px] border border-gray-100 p-8 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white shadow-xl shadow-red-500/20 shrink-0">
                        <Sparkles className="w-10 h-10" />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-gray-900 tracking-tight">Precisa de um Plano Personalizado?</h4>
                        <p className="text-gray-500 font-medium">Fale com os nossos especialistas e criamos a solução ideal para o seu negócio.</p>
                    </div>
                </div>
                <button className="px-10 py-5 bg-gray-900 text-white hover:bg-red-600 rounded-[20px] font-black text-sm uppercase tracking-widest transition-all shadow-xl hover:shadow-red-600/20 active:scale-95">
                    Contactar Vendas
                </button>
            </div>
        </div>
    )
}
