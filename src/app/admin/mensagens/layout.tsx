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

          {/* Tabs Navigation */}
          <div className="flex gap-1 border-b border-gray-100">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              const Icon = tab.icon;
              
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`
                    flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all duration-200
                    ${isActive 
                      ? 'text-red-600 border-b-2 border-red-600 bg-red-50/50' 
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}
                  `}
                >
                  <Icon size={18} />
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
