'use client';

import React from 'react';
import { 
  Home, Globe, Users, Mail, Shield, Database, Settings, Layout, Package,
  LogOut, ChevronRight, Archive, Lock, Server, Download, PanelLeftClose, PanelLeftOpen,
  RefreshCw, Plus, Trash2, Edit2, CheckCircle, XCircle, 
  AlertCircle, ArrowRightLeft, Webhook,
  Save, X, Filter
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface AdminSidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  sessionUser: string | null;
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'emails-new', label: 'Gestão de E-mails', icon: Mail },
  { id: 'domains', label: 'Websites', icon: Globe },
  { id: 'packages-list', label: 'Pacotes', icon: Package },
  { id: 'cp-users', label: 'Contas', icon: Users },
  { id: 'backup-manager', label: 'Backups', icon: Archive },
  { id: 'cp-databases', label: 'Databases', icon: Database },
  { id: 'webmail', label: 'Webmail (Caixa)', icon: Mail },
  { id: 'newsletter', label: 'Marketing / News', icon: Layout },
  { id: 'cp-ssl', label: 'SSL', icon: Lock },
  { id: 'cp-security', label: 'Segurança', icon: Shield },
  { id: 'cp-php', label: 'PHP', icon: Server },
  { id: 'git-deploy', label: 'Deploy / GitHub', icon: Download },
  { id: 'cp-api', label: 'Configurações', icon: Settings },
];

export function AdminSidebar({ 
  activeSection, 
  onNavigate, 
  isCollapsed, 
  setIsCollapsed, 
  sessionUser 
}: AdminSidebarProps) {
  const currentSidebarWidth = isCollapsed ? 80 : 250;

  return (
    <div
      className="relative bg-white border-r border-gray-200 text-gray-800 flex flex-col shadow-sm h-screen transition-all duration-300"
      style={{ width: `${currentSidebarWidth}px` }}
    >
      {/* Sidebar Header */}
      <div className="px-2 pb-4 border-b border-gray-100 pt-4">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3">
            <img 
              src="/assets/simbolo.png" 
              alt="Logo" 
              className="h-12 object-contain cursor-pointer" 
              onClick={() => window.location.href = '/'} 
            />
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)} 
              className="rounded-lg hover:bg-gray-100 transition-colors p-1"
              title="Expandir"
            >
              <LogOut size={22} className="text-gray-500" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <img 
              src="/assets/simbolo.png" 
              alt="Logo" 
              className="w-14 h-14 object-contain cursor-pointer" 
              onClick={() => window.location.href = '/'} 
            />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">Painel Admin</h1>
              <p className="text-xs text-gray-500">Portal Digital</p>
            </div>
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)} 
              className="rounded-lg hover:bg-gray-100 transition-colors p-1"
              title="Recolher"
            >
              <LogOut size={22} className="text-gray-500 -scale-x-100" />
            </button>
          </div>
        )}
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto px-2 py-2.5">
        <div className="space-y-0">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id ||
              (item.id === 'domains' && ['domains', 'domains-new', 'domains-list'].includes(activeSection)) ||
              (item.id === 'emails-new' && activeSection.startsWith('cp-email')) ||
              (item.id === 'newsletter' && activeSection === 'newsletter');
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'newsletter') {
                    window.location.href = '/admin/mensagens';
                  } else {
                    onNavigate(item.id);
                  }
                }}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} ${isCollapsed ? 'px-2 py-2' : 'p-2.5'} rounded-lg transition-colors ${isActive
                  ? 'bg-red-50 text-red-600 font-bold border-l-4 border-red-600 rounded-none rounded-r-lg'
                  : 'hover:bg-gray-100 text-gray-600'
                  }`}
                title={isCollapsed ? item.label : ''}
              >
                <Icon size={22} className={isActive ? 'text-red-600' : 'text-gray-500'} />
                {!isCollapsed && (
                  <span className="ml-3 text-[15px]">{item.label}</span>
                )}
                {!isCollapsed && isActive && (
                  <ChevronRight size={14} className="ml-auto text-red-400" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-gray-100">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">
              {sessionUser?.charAt(0).toUpperCase() || 'SC'}
            </span>
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900 truncate">
                {sessionUser ? sessionUser.split('@')[0] : 'Silva Chamo'}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{sessionUser || 'admin@your-domain.com'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
