'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/dashboard/Sidebar'
import { Search, User } from 'lucide-react'
import { NotificationsPanel } from '@/components/dashboard/NotificationsPanel'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [isLoading, setIsLoading] = useState(true)
    const [userEmail, setUserEmail] = useState<string>('')

    useEffect(() => {
        // Verificar autenticação no client-side
        const checkAuth = async () => {
            try {
                const { supabase } = await import('@/lib/supabase-client')
                const { data: { user } } = await supabase.auth.getUser()
                
                if (!user) {
                    window.location.href = '/auth/login'
                    return
                }
                
                setUserEmail(user.email || '')
            } catch (error) {
                console.error('Auth error:', error)
            } finally {
                setIsLoading(false)
            }
        }
        
        checkAuth()
    }, [])

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando dashboard...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-exo-2 flex">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 min-h-screen">
                {/* Top Header */}
                <header className="h-20 border-b border-gray-200 px-6 lg:px-10 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-30 shadow-sm">
                    <div className="flex items-center gap-4 bg-gray-100 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 focus-within:text-gray-900 transition-colors w-full max-w-md hidden md:flex">
                        <Search className="w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Pesquisar nos meus serviços..."
                            className="bg-transparent border-none focus:outline-none w-full text-sm font-medium"
                        />
                    </div>

                    <div className="flex items-center gap-4 ml-auto">
                        <NotificationsPanel userEmail={userEmail} />
                        <div className="h-8 w-[1px] bg-gray-300 mx-2"></div>
                        <button className="flex items-center gap-3 pl-2 group">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-gray-900 leading-tight">Cliente Portal</p>
                                <p className="text-xs text-gray-500 font-medium tracking-wide">ID: #GEST001</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-white ring-2 ring-gray-200 group-hover:ring-red-600/50 transition-all">
                                <User className="w-6 h-6" />
                            </div>
                        </button>
                    </div>
                </header>

                {/* Content Area */}
                <div className="p-6 lg:p-10">
                    {children}
                </div>
            </main>
        </div>
    )
}
