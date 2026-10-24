'use client';

import React, { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { CompanyLogoUpload, fetchCompanyLogoUrl } from '@/components/vhost/comuns/CompanyLogoUpload';

/**
 * Único sítio onde o revendedor define o seu logótipo — guardado em
 * profiles.logo_url via /api/mailmarketing-logo (mesmo backend usado pelo
 * Composer de Mailmarketing e por "A Minha Conta"). Todos os outros lugares
 * do painel (barra lateral, cabeçalho dos templates de email) leem daqui,
 * em vez de terem cada um o seu próprio campo de upload.
 */
export function ResellerSettingsSection({ onLogoChange }: { onLogoChange?: (logo: string | null) => void }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanyLogoUrl().then(setLogoUrl);
  }, []);

  const handleChange = (url: string | null) => {
    setLogoUrl(url);
    onLogoChange?.(url);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-red-600" /> Branding & Logótipo
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Personalize a identidade visual do seu portal. Este logótipo é usado na barra lateral do
          painel e no cabeçalho dos templates de Mailmarketing enviados aos seus clientes.
        </p>
        <CompanyLogoUpload value={logoUrl} onChange={handleChange} />
      </div>
    </div>
  );
}
