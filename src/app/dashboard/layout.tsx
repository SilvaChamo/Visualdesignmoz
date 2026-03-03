import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Sidebar from '@/components/dashboard/Sidebar'
import { Bell, Search, User } from 'lucide-react'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        notFound();
    }

    const userRole = session.user?.user_metadata?.role;
    const adminEmails = ['admin@visualdesigne.com', 'silva.chamo@gmail.com'];
    const isExplicitAdmin = adminEmails.includes(session.user?.email || '');

    if (userRole !== 'reseller' && userRole !== 'admin' && !isExplicitAdmin) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-exo-2 flex">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 min-h-screen">
                {/* Top Header */}
                <header className="h-20 border-b border-gray-200 px-6 lg:px-10 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-30 shadow-sm">
                    <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-xl border border-white/5 text-gray-400 focus-within:text-white transition-colors w-full max-w-md hidden md:flex">
                        <Search className="w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Pesquisar nos meus serviços..."
                            className="bg-transparent border-none focus:outline-none w-full text-sm font-medium"
                        />
                    </div>

                    <div className="flex items-center gap-4 ml-auto">
                        <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
                            <Bell className="w-6 h-6" />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full border border-black"></span>
                        </button>
                        <div className="h-8 w-[1px] bg-white/5 mx-2"></div>
                        <button className="flex items-center gap-3 pl-2 group">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-white leading-tight">Cliente Visualdesign</p>
                                <p className="text-xs text-gray-500 font-medium tracking-wide">ID: #VD89231</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-white ring-2 ring-white/5 group-hover:ring-red-600/50 transition-all">
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
