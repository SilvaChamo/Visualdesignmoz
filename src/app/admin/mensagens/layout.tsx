'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { Mail, Users, History, ChevronLeft } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { supabase as createClientInstance } from '@/lib/supabase';

export default function MensagensLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
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
    { name: 'Enviar Emails', href: '/admin/mensagens', icon: Mail },
    { name: 'Subscritores', href: '/admin/mensagens/subscritores', icon: Users },
    { name: 'Campanhas', href: '/admin/mensagens/campanhas', icon: History },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <AdminSidebar 
        activeSection="newsletter"
        onNavigate={(section) => {
          if (section !== 'newsletter') {
            window.location.href = `/admin?section=${section}`;
          }
        }}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        sessionUser={sessionUser}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Area */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link 
                href="/admin" 
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
              >
                <ChevronLeft size={20} />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Email Marketing</h1>
                <p className="text-sm text-gray-500">Gira as tuas campanhas e lista de subscritores</p>
              </div>
            </div>
          </div>

          {/* Tabs Navigation - estilo alinhado ao client */}
          <div className="flex relative bg-slate-100 p-1 rounded-lg shadow-inner w-fit">
            <div
              className="absolute top-1 bottom-1 bg-white rounded-md shadow-sm transition-all duration-300 ease-out"
              style={{
                width: 'calc(33.33% - 2.66px)',
                left: pathname === '/admin/mensagens'
                  ? '4px'
                  : pathname === '/admin/mensagens/campanhas'
                    ? 'calc(33.33% + 1.33px)'
                    : 'calc(66.66% - 1.33px)',
              }}
            />
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`relative z-10 w-[140px] flex items-center justify-center gap-2 py-2 rounded-md text-[11px] font-black uppercase tracking-widest transition-all ${isActive ? 'text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Icon size={15} />
                  {tab.name}
                </Link>
              );
            })}
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
