'use client';

import React, { useState, useEffect } from 'react';
import { Upload, Save, CheckCircle, Image as ImageIcon } from 'lucide-react';

export function ResellerSettingsSection({ onLogoChange }: { onLogoChange?: (logo: string) => void }) {
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [preview, setPreview] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Carregar o logo actual do localStorage (simulando base de dados)
    const savedLogo = localStorage.getItem('reseller_custom_logo');
    const defaultLogo = '/assets/simbolo.png';
    
    if (savedLogo) {
      setLogoUrl(savedLogo);
      setPreview(savedLogo);
    } else {
      setLogoUrl(defaultLogo);
      setPreview(defaultLogo);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    setIsSaving(true);
    setMessage('');
    
    setTimeout(() => {
      // Salvar a nova imagem
      if (preview) {
        localStorage.setItem('reseller_custom_logo', preview);
        setLogoUrl(preview);
        if (onLogoChange) onLogoChange(preview);
        setMessage('Logótipo actualizado com sucesso!');
      }
      setIsSaving(false);
    }, 800);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-red-600" /> Branding & Logótipo
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Personalize a identidade visual do seu portal. O logótipo que enviar aqui será apresentado na barra lateral esquerda e nos cabeçalhos dos relatórios/notificações enviadas aos seus clientes.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Logótipo Actual</label>
            <div className="flex items-center gap-6">
              <div className="w-40 h-24 bg-gray-50 border border-gray-200 border-dashed rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
                {preview ? (
                  <img src={preview} alt="Logo Preview" className="max-w-full max-h-full object-contain p-2" />
                ) : (
                  <span className="text-xs text-gray-400">Sem imagem</span>
                )}
              </div>
              
              <div className="flex-1">
                <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded cursor-pointer transition-colors w-fit">
                  <Upload size={16} />
                  <span>Escolher nova imagem...</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
                <p className="text-xs text-gray-400 mt-2">Formatos suportados: PNG, JPG ou SVG. Altura recomendada: 60px.</p>
              </div>
            </div>
          </div>

          {message && (
            <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded text-sm flex items-center gap-2">
              <CheckCircle size={16} /> {message}
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving || preview === logoUrl}
              className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {isSaving ? 'A guardar...' : <><Save size={16} /> Guardar Alterações</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
