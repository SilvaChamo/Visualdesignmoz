'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { Mail, Users, History, LogOut } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { usePanelSidebarCollapsed } from '@/hooks/usePanelSidebarCollapsed';
import { supabase as createClientInstance } from '@/lib/supabase';

export default function MensagensLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isCollapsed, setIsCollapsed, isMobile } = usePanelSidebarCollapsed();
  const [sessionUser, setSessionUser] = useState<string | null>(null);

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await createClientInstance.auth.getSession();
        if (session?.user?.email) {
          setSessionUser(session.user.email);
        }
      } catch (error) {
        console.error('Erro ao obter sessão:', error);
      }
    };
    getSession();
  }, []);

  const tabs = [
    { name: 'Compor', href: '/dashboard/mensagens', icon: Mail },
    { name: 'Subscritores', href: '/dashboard/mensagens/subscritores', icon: Users },
    { name: 'Campanhas', href: '/dashboard/mensagens/campanhas', icon: History },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <AdminSidebar 
        activeSection="newsletter"
        onNavigate={(section) => {
          if (section === 'newsletter') {
            router.push('/dashboard/mensagens');
          } else {
            router.push(`/dashboard?section=${section}`);
          }
        }}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        sessionUser={sessionUser}
        isMobile={isMobile}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Area */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-xs text-gray-400 mt-0.5">Gestão de email marketing</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Tabs Navigation */}
              <div className="flex bg-slate-100 p-1 rounded-lg shadow-inner">
                {tabs.map((tab) => {
                  const isActive = pathname === tab.href;
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={`flex-1 flex items-center justify-center py-1.5 px-3 rounded-md text-[10px] font-black uppercase text-center transition-all ${isActive ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {tab.name}
                    </Link>
                  );
                })}
              </div>

              {/* Botão Sair */}
              <button
                onClick={async () => { await createClientInstance.auth.signOut(); window.location.href = '/auth/login'; }}
                className="bg-gray-700 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                title="Sair da Conta"
              >
                <LogOut size={13} />
                Sair da Conta
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
