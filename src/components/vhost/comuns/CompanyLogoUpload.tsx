'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

// Logótipo próprio de cada conta (revendedor/cliente/profissional), usado no
// cabeçalho dos templates de Mailmarketing em vez do logo da VisualDesign —
// ver src/app/api/mailmarketing-logo/route.ts e src/components/admin/EmailTemplates.tsx.
export function CompanyLogoUpload({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/mailmarketing-logo', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar logótipo');
      onChange(data.url);
      toast.success('Logótipo guardado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar logótipo');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mailmarketing-logo', { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao remover logótipo');
      onChange(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover logótipo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">Logótipo da Empresa</label>
      <p className="text-[11px] text-gray-400 dark:text-zinc-500 leading-relaxed">Aparece no cabeçalho dos templates de email, em vez do logo da VisualDesign.</p>
      <div className="flex items-center gap-3">
        <div className="w-32 h-14 rounded-md border border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
          {value ? (
            <img src={value} alt="Logótipo da empresa" className="max-w-full max-h-full object-contain" />
          ) : (
            <ImageIcon className="w-5 h-5 text-gray-300 dark:text-zinc-600" />
          )}
        </div>
        <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        <button
          type="button"
          disabled={loading}
          onClick={() => fileInputRef.current?.click()}
          className="h-9 px-3 rounded-md border border-gray-200 dark:border-zinc-700 text-xs font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {value ? 'Alterar' : 'Enviar logótipo'}
        </button>
        {value && (
          <button
            type="button"
            disabled={loading}
            onClick={handleRemove}
            title="Remover logótipo"
            className="h-9 w-9 rounded-md border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Busca o logótipo já guardado da conta autenticada — usado uma vez ao
// montar o Composer, tanto no painel partilhado (admin/revendedor) como no
// portal do cliente/profissional.
export async function fetchCompanyLogoUrl(): Promise<string | null> {
  try {
    const res = await fetch('/api/mailmarketing-logo');
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  } catch {
    return null;
  }
}
