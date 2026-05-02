'use client';

import React from 'react';
import { 
  Home, Globe, Users, Mail, Shield, Database, Settings, Layout, Package,
  LogOut, ChevronRight, Archive, Lock, Server, Download, PanelLeftClose, PanelLeftOpen,
  RefreshCw, Plus, Trash2, Edit2, CheckCircle, XCircle, 
  AlertCircle, ArrowRightLeft, Webhook,
  Save, X, Filter, Calendar, Bell, Palette
} from 'lucide-react';

interface ResellerSidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  sessionUser: string | null;
  customLogo?: string;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  subItems?: { id: string; label: string }[];
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },

  {
    id: 'gestao-sites',
    label: 'Gestão de Sites',
    icon: Globe,
    subItems: [
      { id: 'domains', label: 'Sites Next.js' },
      { id: 'cp-wp-list', label: 'Sites WordPress' },
    ]
  },
  {
    id: 'gestao-dominios',
    label: 'Gestão de Domínios',
    icon: Server,
    subItems: [
      { id: 'domains-list', label: 'Listar Domínios' },
      { id: 'domains-new', label: 'Criar Domínio' },
      { id: 'cp-subdomains', label: 'Criar Subdomínio' },
      { id: 'cp-suspend-website', label: 'Suspender' },
      { id: 'domains-dns', label: 'Configurar DNS' },
      { id: 'dns-central', label: 'DNS Central' },
    ]
  },
  {
    id: 'wordpress',
    label: 'Gestão de sites WP',
    icon: Globe,
    subItems: [
      { id: 'wordpress-install', label: 'Instalar WordPress' },
      { id: 'cp-wp-plugins', label: 'Gerir plugins' },
      { id: 'packages-list', label: 'Pacotes' },
    ]
  },
  {
    id: 'page-builders',
    label: 'Construtores',
    icon: Palette,
    subItems: [
      { id: 'page-builders', label: 'Abrir Construtores' },
      { id: 'templates-saved', label: 'Templates Salvos' },
    ]
  },
  {
    id: 'gestao-emails',
    label: 'Gestão de E-mails',
    icon: Mail,
    subItems: [
      { id: 'emails-new', label: 'E-mails' },
      { id: 'webmail', label: 'Webmail' },
      { id: 'newsletter', label: 'Mailmarketing' },
      { id: 'cp-email-dkim', label: 'DKIM Manager' },
    ]
  },
  {
    id: 'notificacoes',
    label: 'Notificações',
    icon: Bell,
    subItems: [
      { id: 'renewals', label: 'Visão Geral' },
      { id: 'cadastrar-renovacao', label: 'Cadastrar' },
      { id: 'templates-renovacao', label: 'Templates' },
    ]
  },
  {
    id: 'configuracoes',
    label: 'Definições',
    icon: Settings,
    subItems: [
      { id: 'settings-branding', label: 'Branding & Logo' },
      { id: 'settings-profile', label: 'Meu Perfil' },
    ]
  },
];

export function ResellerSidebar({ 
  activeSection, 
  onNavigate, 
  isCollapsed, 
  setIsCollapsed, 
  sessionUser,
  customLogo
}: ResellerSidebarProps) {
  const currentSidebarWidth = isCollapsed ? 80 : 250;
  const logoUrl = customLogo || '/assets/simbolo.png';

  const [expandedMenus, setExpandedMenus] = React.useState<Record<string, boolean>>({
    'gestao-sites': false,
    'gestao-dominios': false,
    'wordpress': false,
    'page-builders': false,
    'gestao-emails': false,
    'notificacoes': false,
  });

  const toggleExpand = (id: string) => {
    setExpandedMenus(prev => {
      const isCurrentlyExpanded = prev[id];
      // Se estamos a expandir um novo menu, fechamos todos os outros
      if (!isCurrentlyExpanded) {
        const newState: Record<string, boolean> = {};
        Object.keys(prev).forEach(key => {
          newState[key] = false;
        });
        return { ...newState, [id]: true };
      }
      // Se estamos a fechar, apenas fechamos esse
      return { ...prev, [id]: false };
    });
  };

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
              src={logoUrl} 
              alt="Logo" 
              className="h-12 w-full object-contain cursor-pointer" 
              onClick={() => window.location.href = '/revendedor'} 
            />
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)} 
              className="rounded hover:bg-gray-100 transition-colors p-1"
              title="Expandir"
            >
              <LogOut size={22} className="text-gray-500" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <img 
              src={logoUrl} 
              alt="Logo" 
              className="w-auto h-12 max-w-[140px] object-contain cursor-pointer" 
              onClick={() => window.location.href = '/revendedor'} 
            />
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)} 
              className="rounded hover:bg-gray-100 transition-colors p-1"
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
              (item.id === 'newsletter' && activeSection === 'newsletter') ||
              (item.id === 'gestao-dominios' && ['domains-list', 'domains-new', 'cp-subdomains', 'cp-suspend-website', 'domains-dns', 'dns-central', 'cp-delete-website'].includes(activeSection)) ||
              (item.id === 'gestao-sites' && ['domains', 'cp-wp-list', 'cp-users'].includes(activeSection)) ||
              (item.id === 'gestao-emails' && ['emails-new', 'criar-email', 'webmail', 'cp-email-dkim', 'newsletter'].includes(activeSection)) ||
              (item.id === 'notificacoes' && ['renewals', 'cadastrar-renovacao', 'templates-renovacao'].includes(activeSection)) ||
              (item.id === 'wordpress' && ['wordpress-install', 'cp-wp-plugins', 'cp-wp-backup', 'cp-wp-restore-backup', 'cp-wp-remote-backup', 'packages-list'].includes(activeSection)) ||
              (item.id === 'configuracoes' && ['settings-branding', 'settings-profile'].includes(activeSection));
            
            return (
              <div key={item.id} className="mb-1">
                <button
                  onClick={() => {
                    if (item.subItems) {
                      toggleExpand(item.id);
                    } else {
                      // Fechar todos os submenus ao clicar em item sem submenu (ex: Dashboard)
                      setExpandedMenus(prev => {
                        const newState: Record<string, boolean> = {};
                        Object.keys(prev).forEach(key => {
                          newState[key] = false;
                        });
                        return newState;
                      });
                      onNavigate(item.id);
                    }
                  }}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} ${isCollapsed ? 'px-2 py-2' : 'px-2.5 py-2'} rounded-lg transition-all duration-200 ease-out hover:translate-x-1 group ${
                    isActive || (expandedMenus[item.id] && item.subItems)
                      ? item.id === 'dashboard'
                        ? 'text-red-600 font-bold bg-red-50 border-l-[3px] border-red-600 ml-[5px] pl-1.5 rounded-none'
                        : 'text-black font-bold'
                      : 'hover:text-red-600 text-gray-600'
                    }`}
                  title={isCollapsed ? item.label : ''}
                >
                  <Icon size={22} className={`${isActive || expandedMenus[item.id] ? (item.id === 'dashboard' ? 'text-red-600' : 'text-gray-900') : 'text-gray-500 group-hover:text-red-600'}`} />
                  {!isCollapsed && (
                    <span className="ml-3 text-[15px]">{item.label}</span>
                  )}
                  {!isCollapsed && item.subItems && (
                    <ChevronRight size={14} className={`ml-auto text-gray-400 transition-transform ${expandedMenus[item.id] ? 'rotate-90' : ''}`} />
                  )}
                  {!isCollapsed && !item.subItems && isActive && (
                    <ChevronRight size={14} className={`ml-auto ${item.id === 'dashboard' ? 'text-red-600' : 'text-gray-900'}`} />
                  )}
                </button>

                {/* SubMenu Items */}
                {!isCollapsed && item.subItems && expandedMenus[item.id] && (
                  <div className="mt-1 ml-9 border-l border-gray-200 flex flex-col gap-1">
                    {item.subItems.map(sub => {
                      const isSubActive = activeSection === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => onNavigate(sub.id)}
                          className={`flex items-center text-left px-3 py-[5px] text-sm transition-colors relative ${isSubActive
                            ? 'text-red-600 font-bold before:absolute before:-left-[1px] before:top-1/2 before:-translate-y-1/2 before:w-[2px] before:h-3 before:bg-red-600 before:rounded-full before:z-10'
                            : 'text-gray-600 hover:text-red-600'}`}
                        >
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
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
