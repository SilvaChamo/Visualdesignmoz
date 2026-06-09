'use client';

import React from 'react';
import {
  Home, Globe, Mail, Layout,
  LogOut, ChevronRight, Server, Download,
  Bell,
} from 'lucide-react';

interface AdminSidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  sessionUser: string | null;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  subItems?: { id: string; label: string }[];
}

const GESTAO_HOSPEDAGEM_SECTIONS = [
  'domains', 'packages-list', 'cp-databases', 'cp-ftp', 'cp-ssl',
  'cp-security', 'cp-php', 'backup-manager', 'infrastructure', 'cp-reseller',
];

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  {
    id: 'gestao-paineis',
    label: 'Gestão de Painéis',
    icon: Layout,
    subItems: [
      { id: 'cp-client-permissions', label: 'Painel do Cliente' },
      { id: 'cp-reseller-permissions', label: 'Painel do Revendedor' },
      { id: 'cp-users', label: 'Utilizadores' },
    ]
  },
  {
    id: 'gestao-sites',
    label: 'Gestor de Hospedagem',
    icon: Server,
    subItems: [
      { id: 'domains', label: 'Listar Websites' },
      { id: 'packages-list', label: 'Pacotes' },
      { id: 'cp-databases', label: 'Bases de Dados' },
      { id: 'cp-ftp', label: 'Contas FTP' },
      { id: 'cp-ssl', label: 'SSL / TLS' },
      { id: 'cp-security', label: 'Segurança' },
      { id: 'cp-php', label: 'Configuração PHP' },
      { id: 'backup-manager', label: 'Backups' },
      { id: 'infrastructure', label: 'Estado do Servidor' },
      { id: 'cp-reseller', label: 'Centro de Revenda' },
    ]
  },
  {
    id: 'gestao-dominios',
    label: 'Gestão de Domínios',
    icon: Globe,
    subItems: [
      { id: 'porkbun-domains', label: 'Registar domínio' },
      { id: 'porkbun-my-domains', label: 'Os seus domínios' },
      { id: 'dns-central', label: 'DNS Central' },
      { id: 'domain-manager', label: 'Gestor de domínios' },
      { id: 'cp-subdomains', label: 'Criar Subdomínio' },
      { id: 'cp-list-subdomains', label: 'Listar Sub/Addon' },
      { id: 'cp-modify-website', label: 'Modificar Website' },
      { id: 'cp-suspend-website', label: 'Suspender' },
      { id: 'cp-delete-website', label: 'Apagar Website' },
      { id: 'domains-dns', label: 'Configurar DNS (servidor)' },
      { id: 'cp-dns-nameserver', label: 'Gerir Nameservers' },
    ]
  },
  {
    id: 'gestao-emails',
    label: 'Gestão de E-mails',
    icon: Mail,
    subItems: [
      { id: 'emails-new', label: 'E-mails' },
      { id: 'webmail', label: 'Webmail' },
      { id: 'cp-email-dkim', label: 'DKIM Manager' },
    ]
  },
  { id: 'newsletter', label: 'Mailmarketing', icon: Layout },
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
  { id: 'git-deploy', label: 'Deploy / GitHub', icon: Download },
];

const GESTAO_DOMINIOS_SECTIONS = [
  'cp-subdomains', 'cp-list-subdomains', 'cp-modify-website', 'cp-suspend-website',
  'cp-delete-website', 'domains-dns', 'dns-central', 'cp-dns-nameserver',
  'porkbun-domains', 'porkbun-my-domains', 'domain-manager',
];

function adminMenuParentForSection(sectionId: string): string | null {
  for (const item of menuItems) {
    if (item.id === sectionId) return item.subItems ? item.id : null;
    if (item.subItems?.some((s) => s.id === sectionId)) return item.id;
  }
  if (sectionId.startsWith('cp-email')) return 'gestao-emails';
  if (['emails-new', 'criar-email', 'webmail', 'cp-email-dkim'].includes(sectionId)) return 'gestao-emails';
  if (GESTAO_DOMINIOS_SECTIONS.includes(sectionId)) return 'gestao-dominios';
  if (GESTAO_HOSPEDAGEM_SECTIONS.includes(sectionId)) return 'gestao-sites';
  if (['cp-client-permissions', 'cp-reseller-permissions', 'cp-users'].includes(sectionId)) return 'gestao-paineis';
  if (['renewals', 'cadastrar-renovacao', 'templates-renovacao'].includes(sectionId)) return 'notificacoes';
  return null;
}

export function AdminSidebar({
  activeSection,
  onNavigate,
  isCollapsed,
  setIsCollapsed,
  sessionUser
}: AdminSidebarProps) {
  const currentSidebarWidth = isCollapsed ? 80 : 250;
  const [expandedMenu, setExpandedMenu] = React.useState<string | null>(() =>
    adminMenuParentForSection(activeSection),
  );

  React.useEffect(() => {
    const parent = adminMenuParentForSection(activeSection);
    if (parent) setExpandedMenu(parent);
  }, [activeSection]);

  const handleParentClick = (item: MenuItem) => {
    if (!item.subItems?.length) {
      setExpandedMenu(null);
      if (item.id === 'newsletter') {
        onNavigate('newsletter');
      } else {
        onNavigate(item.id);
      }
      return;
    }

    if (expandedMenu === item.id) {
      setExpandedMenu(null);
      return;
    }

    setExpandedMenu(item.id);
    onNavigate(item.subItems[0].id);
  };

  return (
    <div
      className="relative bg-white border-r border-gray-200 text-gray-800 flex flex-col shadow-sm h-screen transition-all duration-300"
      style={{ width: `${currentSidebarWidth}px` }}
    >
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
              className="rounded hover:bg-gray-100 transition-colors p-1"
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
              className="rounded hover:bg-gray-100 transition-colors p-1"
              title="Recolher"
            >
              <LogOut size={22} className="text-gray-500 -scale-x-100" />
            </button>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2.5">
        <div className="space-y-0">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id ||
              (item.id === 'emails-new' && activeSection.startsWith('cp-email')) ||
              (item.id === 'newsletter' && activeSection === 'newsletter') ||
              (item.id === 'gestao-paineis' && ['cp-client-permissions', 'cp-reseller-permissions', 'cp-users'].includes(activeSection)) ||
              (item.id === 'gestao-dominios' && GESTAO_DOMINIOS_SECTIONS.includes(activeSection)) ||
              (item.id === 'gestao-sites' && GESTAO_HOSPEDAGEM_SECTIONS.includes(activeSection)) ||
              (item.id === 'gestao-emails' && ['emails-new', 'criar-email', 'webmail', 'cp-email-dkim'].includes(activeSection)) ||
              (item.id === 'notificacoes' && ['renewals', 'cadastrar-renovacao', 'templates-renovacao'].includes(activeSection));

            return (
              <div key={item.id} className="mb-1">
                <button
                  onClick={() => handleParentClick(item)}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} ${isCollapsed ? 'px-2 py-2' : 'px-2.5 py-2'} rounded-lg transition-all duration-200 ease-out hover:translate-x-1 group ${isActive || (expandedMenu === item.id && item.subItems)
                    ? item.id === 'dashboard'
                      ? 'text-red-600 font-bold bg-red-50 border-l-[3px] border-red-600 ml-[5px] pl-1.5 rounded-none'
                      : 'text-black font-bold'
                    : 'hover:text-red-600 text-gray-600'
                    }`}
                  title={isCollapsed ? item.label : ''}
                >
                  <Icon size={22} className={`${isActive || expandedMenu === item.id ? (item.id === 'dashboard' ? 'text-red-600' : 'text-gray-900') : 'text-gray-500 group-hover:text-red-600'}`} />
                  {!isCollapsed && (
                    <span className="ml-3 text-[15px]">{item.label}</span>
                  )}
                  {!isCollapsed && item.subItems && (
                    <ChevronRight size={14} className={`ml-auto text-gray-400 transition-transform ${expandedMenu === item.id ? 'rotate-90' : ''}`} />
                  )}
                  {!isCollapsed && !item.subItems && isActive && (
                    <ChevronRight size={14} className={`ml-auto ${item.id === 'dashboard' ? 'text-red-600' : 'text-gray-900'}`} />
                  )}
                </button>

                {!isCollapsed && item.subItems && expandedMenu === item.id && (
                  <div className="mt-1 ml-9 border-l border-gray-200 flex flex-col gap-1">
                    {item.subItems.map(sub => {
                      const isSubActive = activeSection === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => {
                            onNavigate(sub.id);
                          }}
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
