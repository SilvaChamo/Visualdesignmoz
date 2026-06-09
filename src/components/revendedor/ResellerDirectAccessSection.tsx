'use client';

import React from 'react';
import { ExternalLink, Globe, Mail, Server, Key, Copy, Check, Upload } from 'lucide-react';
import { getWebFileManagerUrl } from '@/lib/server-config';

type Props = {
  sessionEmail?: string | null;
  onOpenWebmailInPanel?: () => void;
};

export function ResellerDirectAccessSection({
  sessionEmail,
  onOpenWebmailInPanel,
}: Props) {
  const [copied, setCopied] = React.useState<string | null>(null);
  const [daUsername, setDaUsername] = React.useState('—');
  const [daDomain, setDaDomain] = React.useState<string | null>(null);
  const [provisioned, setProvisioned] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/reseller/da-profile', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.daUsername) {
          setDaUsername(data.daUsername);
          setDaDomain(data.daDomain || null);
          setProvisioned(Boolean(data.provisioned));
        }
      })
      .catch(() => {
        setDaUsername(sessionEmail?.split('@')[0] || '—');
      });
  }, [sessionEmail]);

  const links = [
    {
      id: 'da',
      title: 'DirectAdmin',
      description: 'Painel nativo DirectAdmin — gestão completa da sua conta de revenda.',
      href: '/api/directadmin-access',
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
      description: 'Gestor web (até 2 GB) — login com o mesmo user e password do DirectAdmin. Ideal para backups WordPress.',
      href: getWebFileManagerUrl(),
      icon: Upload,
      color: 'bg-amber-50 border-amber-200 text-amber-700',
      button: 'Abrir gestor de ficheiros',
    },
  ];

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Acesso directo</h2>
        <p className="text-gray-500 mt-1 text-sm">
          Credenciais provisionadas automaticamente ao criar a conta de revenda no painel admin.
        </p>
      </div>

      {!provisioned && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Conta de revenda ainda não ligada ao DirectAdmin. Peça ao administrador para criar ou
          ligar a sua conta em Admin → Utilizadores.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Key className="w-4 h-4 text-gray-500" />
          <h3 className="font-bold text-gray-900 text-sm">Credenciais DirectAdmin</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Utilizador DA</p>
            <div className="flex items-center justify-between gap-2">
              <code className="font-mono text-gray-800">{daUsername}</code>
              <button
                type="button"
                onClick={() => copyText(daUsername, 'user')}
                className="text-gray-400 hover:text-red-600"
                title="Copiar"
              >
                {copied === 'user' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Email / Domínio</p>
            <p className="font-mono text-gray-800 truncate">{sessionEmail || '—'}</p>
            {daDomain && <p className="text-xs text-gray-500 mt-1">Domínio revenda: {daDomain}</p>}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Use a mesma password definida na criação da conta de revenda (painel Visual Design).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
