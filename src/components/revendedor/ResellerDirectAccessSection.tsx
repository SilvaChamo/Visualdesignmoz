'use client';

import React from 'react';
import { ExternalLink, Globe, Mail, Server, Upload } from 'lucide-react';
import { getWebFileManagerUrl, getDirectAdminAccessUrl } from '@/lib/server-config';

type Props = {
  sessionEmail?: string | null;
  onOpenWebmailInPanel?: () => void;
};

export function ResellerDirectAccessSection({
  sessionEmail,
  onOpenWebmailInPanel,
}: Props) {
  const links = [
    {
      id: 'da',
      title: 'DirectAdmin',
      description: 'Painel nativo DirectAdmin — abre automaticamente com a mesma conta do portal.',
      href: getDirectAdminAccessUrl('reseller'),
      icon: Server,
      color: 'bg-red-50 border-red-200 text-red-700',
      button: 'Abrir DirectAdmin',
    },
    {
      id: 'roundcube',
      title: 'Roundcube (Webmail directo)',
      description: 'Entrada directa ao webmail Roundcube.',
      href: sessionEmail
        ? `/api/roundcube-sso?email=${encodeURIComponent(sessionEmail)}`
        : '/api/roundcube-sso',
      icon: Mail,
      color: 'bg-blue-50 border-blue-200 text-blue-700',
      button: 'Abrir Roundcube',
    },
    {
      id: 'webmail-panel',
      title: 'Webmail no painel',
      description: 'Webmail integrado no Visual Design.',
      href: null as string | null,
      icon: Globe,
      color: 'bg-cyan-50 border-cyan-200 text-cyan-700',
      button: 'Abrir no painel',
      onClick: onOpenWebmailInPanel,
    },
    {
      id: 'files',
      title: 'Upload de ficheiros grandes',
      description: 'Gestor web (até 2 GB) — usa a mesma conta do DirectAdmin. Ideal para backups WordPress.',
      href: getWebFileManagerUrl(),
      icon: Upload,
      color: 'bg-amber-50 border-amber-200 text-amber-700',
      button: 'Abrir gestor de ficheiros',
    },
  ];

  return (
    <div className="space-y-6 w-full">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Acesso directo</h2>
        <p className="text-gray-500 mt-1 text-sm">
          Os serviços abrem com as credenciais da sua conta — não é necessário voltar a autenticar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {links.map((link) => {
          const Icon = link.icon;
          const inner = (
            <>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${link.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900">{link.title}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{link.description}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 shrink-0">
                {link.button} <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </>
          );

          if (link.onClick) {
            return (
              <button
                key={link.id}
                type="button"
                onClick={link.onClick}
                className="flex flex-col gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-red-300 hover:shadow-sm transition-all text-left"
              >
                {inner}
              </button>
            );
          }

          return (
            <a
              key={link.id}
              href={link.href!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-red-300 hover:shadow-sm transition-all"
            >
              {inner}
            </a>
          );
        })}
      </div>
    </div>
  );
}
