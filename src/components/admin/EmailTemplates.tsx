"use client";

import { useState } from "react";
import { X, LayoutTemplate, Newspaper, Megaphone, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmailTemplatesProps {
    onSelect: (html: string) => void;
    onClose: () => void;
}

const templates = [
    {
        id: 'news',
        name: 'Notícias Agro',
        description: 'Template para digestão semanal de notícias do sector agrário.',
        icon: Newspaper,
        color: 'emerald',
        html: `
<div style="max-width:600px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:#ffffff;">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#059669,#10b981);padding:32px 24px;text-align:center;">
    <h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:800;letter-spacing:-0.5px;">✨ Visual Design</h1>
    <p style="color:#d1fae5;font-size:12px;margin-top:8px;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Newsletter Semanal</p>
  </div>
  
  <!-- Body -->
  <div style="padding:32px 24px;">
    <h2 style="color:#1e293b;font-size:20px;font-weight:800;margin:0 0 8px 0;">Destaques da Semana</h2>
    <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
      Confira as últimas actualizações do agronegócio moçambicano, cotações e oportunidades.
    </p>
    
    <!-- Article Block -->
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;">
      <h3 style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 8px 0;">📰 [Título do Artigo]</h3>
      <p style="color:#64748b;font-size:13px;line-height:1.5;margin:0 0 12px 0;">[Breve resumo do artigo ou notícia aqui...]</p>
      <a href="#" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:8px 20px;border-radius:6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Ler Mais</a>
    </div>
    
    <!-- Another Block -->
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;">
      <h3 style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 8px 0;">📊 [Cotações de Mercado]</h3>
      <p style="color:#64748b;font-size:13px;line-height:1.5;margin:0;">[Insira dados de mercado ou tabela de preços aqui...]</p>
    </div>
  </div>
  
  <!-- Footer -->
  <div style="background:#f8fafc;padding:24px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">© Visual Design — Soluções Criativas</p>
    <p style="color:#94a3b8;font-size:10px;margin-top:8px;">
      <a href="#" style="color:#64748b;">Desinscrever-se</a>
    </p>
  </div>
</div>`
    },
    {
        id: 'promo',
        name: 'Promoção',
        description: 'Template para promoções de produtos, serviços ou eventos.',
        icon: Megaphone,
        color: 'orange',
        html: `
<div style="max-width:600px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:#ffffff;">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#ea580c,#f97316);padding:40px 24px;text-align:center;">
    <p style="color:#fed7aa;font-size:11px;text-transform:uppercase;letter-spacing:3px;font-weight:800;margin:0 0 8px 0;">Oferta Especial</p>
    <h1 style="color:#ffffff;font-size:28px;margin:0;font-weight:800;">🔥 [Título da Promoção]</h1>
    <p style="color:#ffedd5;font-size:14px;margin-top:12px;">Válido por tempo limitado</p>
  </div>
  
  <!-- Body -->
  <div style="padding:32px 24px;text-align:center;">
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
      [Descreva a promoção, produto ou serviço aqui. Inclua os benefícios principais e porquê o leitor deve agir agora.]
    </p>
    
    <!-- CTA -->
    <a href="#" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1px;box-shadow:0 4px 14px rgba(234,88,12,0.3);">Aproveitar Agora →</a>
    
    <!-- Details -->
    <div style="margin-top:32px;padding:20px;background:#fff7ed;border-radius:12px;border:1px solid #fed7aa;">
      <h3 style="color:#9a3412;font-size:14px;font-weight:700;margin:0 0 8px 0;">Detalhes</h3>
      <p style="color:#c2410c;font-size:13px;line-height:1.5;margin:0;">[Condições, preços, datas relevantes]</p>
    </div>
  </div>
  
  <!-- Footer -->
  <div style="background:#1e293b;padding:24px;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">Visual Design — Marketing & Emailing Profissional</p>
    <p style="color:#64748b;font-size:10px;margin-top:8px;">
      <a href="#" style="color:#64748b;">Desinscrever-se</a>
    </p>
  </div>
</div>`
    },
    {
        id: 'alert',
        name: 'Alerta Informativo',
        description: 'Template para comunicações importantes e alertas.',
        icon: AlertTriangle,
        color: 'blue',
        html: `
<div style="max-width:600px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:#ffffff;">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1d4ed8,#3b82f6);padding:32px 24px;text-align:center;">
    <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:800;">ℹ️ Comunicado Importante</h1>
  </div>
  
  <!-- Body -->
  <div style="padding:32px 24px;">
    <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="color:#1e40af;font-size:14px;font-weight:700;margin:0;">Resumo</p>
      <p style="color:#1e3a5f;font-size:13px;line-height:1.6;margin:8px 0 0 0;">[Breve descrição do objectivo deste comunicado.]</p>
    </div>
    
    <h3 style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 12px 0;">[Título do Assunto]</h3>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 16px 0;">
      [Conteúdo detalhado da comunicação. Explique o que mudou, o que o destinatário precisa de saber ou que acção tomar.]
    </p>
    
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 24px 0;">
      [Segundo parágrafo com informações adicionais, se necessário.]
    </p>
    
    <a href="#" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 28px;border-radius:6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Saber Mais</a>
  </div>
  
  <!-- Footer -->
  <div style="background:#f8fafc;padding:20px 24px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">Visual Design</p>
    <p style="color:#94a3b8;font-size:10px;margin-top:8px;">
      <a href="#" style="color:#64748b;">Desinscrever-se</a>
    </p>
  </div>
</div>`
    },
];

export function EmailTemplates({ onSelect, onClose }: EmailTemplatesProps) {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const colorMap: Record<string, { bg: string; border: string; text: string; ring: string }> = {
        emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', ring: 'ring-emerald-500' },
        orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', ring: 'ring-orange-500' },
        blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', ring: 'ring-blue-500' },
    };

    const handleConfirm = () => {
        const template = templates.find(t => t.id === selectedId);
        if (template) {
            onSelect(template.html);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <LayoutTemplate className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">Escolher Template</h2>
                            <p className="text-xs text-slate-500">Selecione um design profissional para o seu email.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Templates Grid */}
                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {templates.map((template) => {
                            const colors = colorMap[template.color];
                            const isSelected = selectedId === template.id;
                            const Icon = template.icon;

                            return (
                                <button
                                    key={template.id}
                                    onClick={() => setSelectedId(template.id)}
                                    className={`relative text-left p-5 rounded-xl border-2 transition-all hover:shadow-md ${isSelected
                                            ? `${colors.border} ${colors.bg} ring-2 ${colors.ring}`
                                            : 'border-slate-100 bg-white hover:border-slate-200'
                                        }`}
                                >
                                    {isSelected && (
                                        <div className={`absolute top-3 right-3 w-6 h-6 ${colors.bg} rounded-full flex items-center justify-center`}>
                                            <Check className={`w-4 h-4 ${colors.text}`} />
                                        </div>
                                    )}
                                    <div className={`w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center mb-4`}>
                                        <Icon className={`w-6 h-6 ${colors.text}`} />
                                    </div>
                                    <h3 className="font-bold text-sm text-slate-900 mb-1">{template.name}</h3>
                                    <p className="text-xs text-slate-500 leading-relaxed">{template.description}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedId}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs font-bold uppercase"
                    >
                        <Check className="w-4 h-4" /> Usar Template
                    </Button>
                </div>
            </div>
        </div>
    );
}
