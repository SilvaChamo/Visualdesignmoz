'use client';

import React from 'react';
import {
  Home, Globe, Mail, Layout,
  LogOut, ChevronRight, Server, Download,
  Bell,
} from 'lucide-react';
import { SidebarAccount } from '@/components/panel/SidebarAccount';

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

function isAdminItemActive(item: MenuItem, activeSection: string): boolean {
  if (activeSection === item.id) return true;
  if (item.id === 'newsletter' && activeSection === 'newsletter') return true;
  if (item.id === 'gestao-paineis' && ['cp-client-permissions', 'cp-reseller-permissions', 'cp-users'].includes(activeSection)) return true;
  if (item.id === 'gestao-dominios' && GESTAO_DOMINIOS_SECTIONS.includes(activeSection)) return true;
  if (item.id === 'gestao-sites' && GESTAO_HOSPEDAGEM_SECTIONS.includes(activeSection)) return true;
  if (item.id === 'gestao-emails' && ['emails-new', 'criar-email', 'webmail', 'cp-email-dkim'].includes(activeSection)) return true;
  if (item.id === 'notificacoes' && ['renewals', 'cadastrar-renovacao', 'templates-renovacao'].includes(activeSection)) return true;
  if (item.subItems?.some((s) => s.id === activeSection)) return true;
  return false;
}

export function AdminSidebar({
  activeSection,
  onNavigate,
  isCollapsed,
  setIsCollapsed,
  sessionUser
}: AdminSidebarProps) {
  const currentSidebarWidth = isCollapsed ? 72 : 248;
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
      className="font-panel relative flex h-screen shrink-0 flex-col border-r border-zinc-200 bg-white transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-950"
      style={{ width: `${currentSidebarWidth}px` }}
    >
      <div className="border-b border-zinc-200 px-2 pb-4 pt-4 dark:border-zinc-800">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src="/assets/simbolo.png"
              alt="Logo"
              className="h-10 cursor-pointer object-contain"
              onClick={() => { window.location.href = '/'; }}
            />
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-zinc-800"
              title="Expandir"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <img
              src="/assets/simbolo.png"
              alt="Logo"
              className="h-10 w-10 object-contain cursor-pointer"
              onClick={() => { window.location.href = '/'; }}
            />
            <div className="flex-1 min-w-0">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-zinc-100">Painel Admin</h1>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400">Portal Digital</p>
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
              title="Recolher"
            >
              <LogOut size={18} className="-scale-x-100" />
            </button>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2.5">
        <div className="space-y-0">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = isAdminItemActive(item, activeSection);
            const isOpen = expandedMenu === item.id && !!item.subItems?.length;

            return (
              <div key={item.id} className="mb-1">
                <button
                  onClick={() => handleParentClick(item)}
                  className={`group flex w-full items-center transition-all duration-200 ease-out hover:translate-x-1 ${
                    isCollapsed ? 'justify-center px-2 py-2' : 'px-2.5 py-2'
                  } rounded-lg ${
                    isActive
                      ? 'text-red-600 font-bold border-l-[3px] border-red-600 ml-[5px] pl-1.5 rounded-none'
                      : 'text-gray-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400'
                  }`}
                  title={isCollapsed ? item.label : ''}
                >
                  <Icon
                    size={22}
                    className={isActive ? 'text-red-600' : 'text-gray-500 group-hover:text-red-600 dark:text-zinc-500'}
                  />
                  {!isCollapsed && <span className="ml-3 text-[15px]">{item.label}</span>}
                  {!isCollapsed && item.subItems && (
                    <ChevronRight size={14} className={`ml-auto text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  )}
                </button>

                {!isCollapsed && item.subItems && isOpen && (
                  <div className="mt-1 ml-9 flex flex-col gap-1 border-l border-gray-200 dark:border-zinc-800">
                    {item.subItems.map((sub) => {
                      const isSubActive = activeSection === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => onNavigate(sub.id)}
                          className={`relative flex items-center px-3 py-[5px] text-left text-sm transition-colors ${
                            isSubActive
                              ? 'font-bold text-red-600 before:absolute before:-left-[1px] before:top-1/2 before:h-3 before:w-[2px] before:-translate-y-1/2 before:rounded-full before:bg-red-600'
                              : 'text-gray-600 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400'
                          }`}
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

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <SidebarAccount email={sessionUser} isCollapsed={isCollapsed} />
      </div>
    </div>
  );
}
