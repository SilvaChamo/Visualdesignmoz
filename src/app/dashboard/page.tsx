'use client'

import React from 'react'
import {
    Plus,
    RefreshCw,
    ExternalLink,
    Server,
    Globe2,
    ShieldCheck,
    Clock,
    ArrowRight,
    ChevronRight,
    Mail
} from 'lucide-react'
import Link from 'next/link'
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton'
import UsageProgress from '@/components/dashboard/UsageProgress'
import { useAuth } from '@/components/auth/AuthProvider'
import { supabase } from '@/lib/supabase'

export default function DashboardHome() {
    const [loading, setLoading] = React.useState(true)
    const [subscription, setSubscription] = React.useState<any>(null)

    React.useEffect(() => {
        async function fetchSubscription() {
            try {
                const { data, error } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .limit(1)
                    .single()

                if (data) setSubscription(data)
            } catch (err) {
                console.error('Error fetching subscription:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchSubscription()
    }, [])

    // Fallback / Mock data
    const userAccount = {
        name: subscription?.client_name || "Silva Chamo",
        email: subscription?.client_email || "silva.chamo@gmail.com",
        plan: subscription?.plan || "Hospedagem Pro",
        domain: subscription?.domain || "visualdesign.co.mz",
        renewalDate: subscription?.expiry_date ? new Date(subscription.expiry_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : "20 Mar 2026",
        status: subscription?.status || "active",
        diskUsage: subscription?.disk_used ? (parseInt(subscription.disk_used) / parseInt(subscription.quota || '1024') * 100) : 75,
        diskLimit: subscription?.quota ? `${parseInt(subscription.quota) >= 1024 ? (parseInt(subscription.quota) / 1024).toFixed(0) + 'GB' : subscription.quota + 'MB'}` : "20GB",
        diskCurrent: subscription?.disk_used ? `${parseInt(subscription.disk_used) >= 1024 ? (parseInt(subscription.disk_used) / 1024).toFixed(1) + 'GB' : subscription.disk_used + 'MB'}` : "15GB",
        bandwidthUsage: 20,
        bandwidthLimit: "Unlimited",
        bandwidthCurrent: "450GB"
    }

    if (loading) {
        return <DashboardSkeleton />
    }

    return (
        <div className="space-y-10">
            {/* Welcome Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-200">
                <div>
                    <h1 className="text-3xl lg:text-4xl font-black text-gray-900 mb-2 tracking-tighter">
                        Olá, <span className="text-red-600 font-black">{userAccount.name.split(' ')[0]}!</span>
                    </h1>
                    <p className="text-gray-500 font-medium">Bem-vindo ao seu painel de controlo visualdesign.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl border border-gray-200 transition-all font-bold text-sm shadow-sm">
                        <RefreshCw className="w-4 h-4 text-gray-400 group-hover:rotate-180 transition-transform duration-500" />
                        Sincronizar
                    </button>
                    <button className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-900/20 transition-all font-bold text-sm">
                        <Plus className="w-5 h-5" />
                        Novo Serviço
                    </button>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Active Service Card */}
                <div className="lg:col-span-2 group">
                    <div className="bg-white p-8 rounded-3xl border border-gray-200 relative overflow-hidden h-full shadow-sm hover:shadow-md transition-shadow">
                        {/* Background elements */}
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
                            <Server className="w-32 h-32 text-red-600" />
                        </div>

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-start justify-between mb-8">
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest mb-4 border border-green-100">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
                                        Conta Ativa
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900 mb-1 tracking-tight">{userAccount.plan}</h3>
                                    <p className="text-gray-500 font-medium flex items-center gap-2">
                                        <Globe2 className="w-4 h-4 text-red-600" />
                                        {userAccount.domain}
                                    </p>
                                </div>
                                <button className="p-3 bg-gray-50 hover:bg-red-50 hover:text-red-600 rounded-2xl text-gray-400 transition-all border border-gray-200">
                                    <ExternalLink className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid md:grid-cols-2 gap-10 mt-auto">
                                <UsageProgress
                                    label="Espaço em Disco"
                                    current={userAccount.diskCurrent}
                                    max={userAccount.diskLimit}
                                    percentage={userAccount.diskUsage}
                                />
                                <UsageProgress
                                    label="Tráfego Mensal"
                                    current={userAccount.bandwidthCurrent}
                                    max={userAccount.bandwidthLimit}
                                    percentage={userAccount.bandwidthUsage}
                                    color="blue"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions / Summary */}
                <div className="space-y-6">
                    {/* Renewal Card */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 relative overflow-hidden shadow-sm">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">Próxima Renovação</p>
                                <p className="text-xl font-black text-gray-900 tracking-tight">{userAccount.renewalDate}</p>
                            </div>
                        </div>
                        <button className="w-full py-4 bg-gray-900 text-white hover:bg-red-600 transition-all rounded-2xl font-black text-sm uppercase tracking-wider">
                            Renovar Agora
                        </button>
                    </div>

                    {/* Security Status */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 flex items-center gap-4 shadow-sm">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">Segurança</p>
                            <p className="text-lg font-black text-gray-900 tracking-tight">SSL Protegido</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 ml-auto" />
                    </div>

                    {/* Upgrade Banner */}
                    <div className="bg-red-600 p-6 rounded-3xl relative overflow-hidden shadow-xl shadow-red-900/20">
                        <div className="absolute -bottom-4 -right-4 opacity-20">
                            <Plus className="w-24 h-24 text-white" />
                        </div>
                        <h4 className="text-lg font-black text-white mb-1 leading-tight tracking-tight">Upgrade de Performance</h4>
                        <p className="text-red-100/80 text-xs font-medium mb-4">Aumente os seus limites com 20% desconto.</p>
                        <button className="flex items-center gap-2 text-white font-black text-sm group">
                            Ver Planos Superiores
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>
            {/* Recommended Services - Discreet Marketplace Integration */}
            <div className="pt-10">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Serviços Recomendados</h2>
                        <p className="text-gray-500 font-medium text-sm">Aumente o potencial do seu negócio online.</p>
                    </div>
                    <Link href="/dashboard/marketplace" className="text-red-600 font-black text-sm hover:underline flex items-center gap-1 group">
                        Ver Loja Completa
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* SSL Suggestion */}
                    <Link href="/servicos/ssl" className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-sm">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h4 className="font-black text-gray-900 mb-1 tracking-tight">Certificados SSL</h4>
                        <p className="text-gray-500 text-xs font-medium leading-relaxed mb-4">Segurança máxima e selo de confiança para seu site.</p>
                        <div className="flex items-center text-amber-600 text-[10px] font-black uppercase tracking-widest">
                            Configurar <ChevronRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Link>

                    {/* Email Suggestion */}
                    <Link href="/servicos/email" className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                        <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-sm">
                            <Mail className="w-6 h-6" />
                        </div>
                        <h4 className="font-black text-gray-900 mb-1 tracking-tight">Email Profissional</h4>
                        <p className="text-gray-500 text-xs font-medium leading-relaxed mb-4">Sua marca em todas as comunicações enviadas.</p>
                        <div className="flex items-center text-purple-600 text-[10px] font-black uppercase tracking-widest">
                            Criar Conta <ChevronRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Link>

                    {/* Domains Suggestion */}
                    <Link href="/servicos/dominios" className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                            <Globe2 className="w-6 h-6" />
                        </div>
                        <h4 className="font-black text-gray-900 mb-1 tracking-tight">Domínios .MZ</h4>
                        <p className="text-gray-500 text-xs font-medium leading-relaxed mb-4">Proteja a sua marca com extensões nacionais.</p>
                        <div className="flex items-center text-blue-600 text-[10px] font-black uppercase tracking-widest">
                            Registrar <ChevronRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Link>

                    {/* Digital Card Suggestion */}
                    <Link href="/servicos/cartao-digital" className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4 group-hover:bg-red-600 group-hover:text-white transition-all shadow-sm">
                            <Plus className="w-6 h-6" />
                        </div>
                        <h4 className="font-black text-gray-900 mb-1 tracking-tight">Cartão Digital</h4>
                        <p className="text-gray-500 text-xs font-medium leading-relaxed mb-4">O seu cartão de visita interativo e inovador.</p>
                        <div className="flex items-center text-red-600 text-[10px] font-black uppercase tracking-widest">
                            Experimentar <ChevronRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    )
}
