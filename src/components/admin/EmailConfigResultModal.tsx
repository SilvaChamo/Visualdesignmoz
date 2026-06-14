'use client';

import React from 'react';
import { X, Download, Mail, Copy, Check } from 'lucide-react';
import { panelBtnPrimary, panelBtnSecondary } from '@/lib/panel-ui';
import {
  downloadTextFile,
  shareEmailConfigByMail,
} from '@/lib/email-client-config-export';

export type EmailConfigBundle = {
  email: string;
  password: string;
  plainText: string;
  outlookFile: string;
  shareText: string;
};

type Props = {
  open: boolean;
  config: EmailConfigBundle | null;
  onClose: () => void;
};

export function EmailConfigResultModal({ open, config, onClose }: Props) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!open || !config) return null;

  const domain = config.email.split('@')[1] || 'dominio';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(config.shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
              Configurações Outlook / IMAP
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-gray-500 dark:text-zinc-400">{config.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <pre className="max-h-64 overflow-auto rounded border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
            {config.plainText.trim()}
          </pre>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
          <button
            type="button"
            onClick={onClose}
            className={panelBtnSecondary}
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => downloadTextFile(`configuracao-outlook-${domain}.txt`, config.outlookFile)}
            className={panelBtnSecondary}
          >
            <Download className="h-4 w-4" /> Baixar ficheiro
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className={panelBtnSecondary}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado' : 'Copiar texto'}
          </button>
          <button
            type="button"
            onClick={() => shareEmailConfigByMail(config.email, config.shareText)}
            className={panelBtnPrimary}
          >
            <Mail className="h-4 w-4" /> Partilhar por e-mail
          </button>
        </div>
      </div>
    </div>
  );
}

export async function fetchEmailConfigBundle(email: string): Promise<EmailConfigBundle> {
  const res = await fetch(`/api/email-contas?config_email=${encodeURIComponent(email)}`, {
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Não foi possível obter as configurações.');
  }
  return {
    email: data.email,
    password: data.password,
    plainText: data.plainText,
    outlookFile: data.outlookFile,
    shareText: data.shareText,
  };
}
