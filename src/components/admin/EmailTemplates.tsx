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
        name: 'Notícia',
        description: 'Template para newsletter e comunicações regulares.',
        icon: Newspaper,
        color: 'emerald',
        html: `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Segoe UI',Arial,sans-serif;background-color:#ffffff;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#059669,#10b981);padding:32px 24px;text-align:center;">
            <h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:800;letter-spacing:-0.5px;">[Nome da Empresa]</h1>
            <p style="color:#d1fae5;font-size:12px;margin:8px 0 0 0;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Newsletter</p>
          </td>
        </tr>
        
        <!-- Body -->
        <tr>
          <td style="padding:32px 24px;">
            <h2 style="color:#1e293b;font-size:20px;font-weight:800;margin:0 0 8px 0;">Destaques</h2>
            <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
              Confira as últimas actualizações, novidades e informações relevantes.
            </p>
            
            <!-- Article Block -->
            <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;">
              <h3 style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 8px 0;">[Título da Notícia]</h3>
              <p style="color:#64748b;font-size:13px;line-height:1.5;margin:0 0 12px 0;">[Resumo da notícia ou informação aqui...]</p>
              <a href="#" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:8px 20px;border-radius:6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Ler Mais</a>
            </div>
            
            <!-- Another Block -->
            <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;">
              <h3 style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 8px 0;">[Outra Informação]</h3>
              <p style="color:#64748b;font-size:13px;line-height:1.5;margin:0;">[Detalhes adicionais ou segunda notícia aqui...]</p>
            </div>
          </td>
        </tr>
        
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#64748b;font-size:12px;margin:0 !important;line-height:1.2;">[Nome da Empresa] - [Contacto]</p>
            <p style="color:#94a3b8;font-size:11px;margin:0 !important;line-height:1.2;">
              <a href="#" style="color:#64748b;text-decoration:underline;">Desinscrever-se</a>
            </p>
          </td>
        </tr>
        
      </table>
    </td>
  </tr>
</table>`
    },
    {
        id: 'promo',
        name: 'Promoção',
        description: 'Template para campanhas promocionais e ofertas especiais.',
        icon: Megaphone,
        color: 'orange',
        html: `
<!-- 
  CORES EDITÁVEIS:
  - Cor principal (header, bordas, botões): #f97316 (laranja)
  - Cor de fundo info box: #fff7ed (laranja claro)
  - Cor texto principal: #ffffff (branco no header)
  - Cor texto secundário: #fff7ed (laranja claro no header)
-->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Segoe UI',Arial,sans-serif;background-color:#ffffff;">
  <tr>
    <td align="center">
      <!-- Container principal: 600px largura (padrão email) = ~50% em telas grandes -->
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        
        <!-- Header - COR PRINCIPAL LARANJA -->
        <tr>
          <td style="background-color:#f97316 !important;padding:32px 24px;text-align:center;border-bottom:3px solid #ea580c;mso-background-color:#f97316;">
            <h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:600;">[Nome da Empresa]</h1>
            <p style="color:#fff7ed;font-size:13px;margin-top:8px;">Informação especial para si</p>
          </td>
        </tr>
        
        <!-- Body -->
        <tr>
          <td style="padding:32px 24px;background-color:#ffffff !important;mso-background-color:#ffffff;">
            <h2 style="color:#0f172a;font-size:20px;font-weight:600;margin:0 0 16px 0;">[Título da mensagem]</h2>
            <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
              [Escreva aqui uma descrição natural do produto, serviço ou informação relevante. Use linguagem profissional e evite palavras como "grátis", "urgente", "limitado" ou muitos emojis.]
            </p>
            
            <!-- CTA simplificado -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0;">
              <tr>
                <td align="center">
                  <a href="#" style="display:inline-block;background-color:#f97316 !important;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:500;mso-background-color:#f97316;">Saber mais</a>
                </td>
              </tr>
            </table>
            
            <!-- Info adicional -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
              <tr>
                <td style="padding:20px;background-color:#fff7ed !important;border-radius:8px;border-left:4px solid #f97316;mso-background-color:#fff7ed;">
                  <p style="color:#475569;font-size:13px;line-height:1.5;margin:0;">
                    <strong style="color:#0f172a;">Informação:</strong> [Adicione detalhes relevantes aqui de forma clara e profissional]
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#64748b;font-size:12px;margin:0 !important;line-height:1.2;">[Nome da Empresa] - [Contacto]</p>
            <p style="color:#94a3b8;font-size:11px;margin:0 !important;line-height:1.2;">
              Se não deseja receber estas mensagens, pode <a href="#" style="color:#64748b;text-decoration:underline;">remover subscrição aqui</a>
            </p>
            <p style="color:#94a3b8;font-size:10px;margin:0 !important;line-height:1.2;">[Morada da empresa] | NIF: [NIF]</p>
          </td>
        </tr>
        
      </table>
    </td>
  </tr>
</table>`
    },
    {
        id: 'alert',
        name: 'Alerta',
        description: 'Template para avisos e comunicados importantes.',
        icon: AlertTriangle,
        color: 'blue',
        html: `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Segoe UI',Arial,sans-serif;background-color:#ffffff;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1d4ed8,#3b82f6);padding:32px 24px;text-align:center;">
            <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:800;">ℹ️ Comunicado Importante</h1>
          </td>
        </tr>
        
        <!-- Body -->
        <tr>
          <td style="padding:32px 24px;">
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
          </td>
        </tr>
        
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#64748b;font-size:12px;margin:0 !important;line-height:1.2;">[Nome da Empresa]</p>
            <p style="color:#94a3b8;font-size:11px;margin:0 !important;line-height:1.2;">
              <a href="#" style="color:#64748b;text-decoration:underline;">Desinscrever-se</a>
            </p>
          </td>
        </tr>
        
      </table>
    </td>
  </tr>
</table>`
    },
];

export function EmailTemplates({ onSelect, onClose }: EmailTemplatesProps) {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const colorMap: Record<string, { bg: string; border: string; text: string; ring: string }> = {
        emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', ring: 'ring-emerald-500' },
        orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', ring: 'ring-orange-500' },
        blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', ring: 'ring-blue-500' },
    };

    const handleSelect = (html: string) => {
        onSelect(html);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-gray-900/40 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <LayoutTemplate className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800 tracking-wider">Escolher Template</h2>
                            <p className="text-xs text-gray-500 mt-1">Clique num template para aplicar automaticamente</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors group">
                        <X className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
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
                                    onClick={() => handleSelect(template.html)}
                                    className={`relative text-left p-5 rounded-lg border-2 transition-all hover:shadow-sm ${isSelected
                                            ? `${colors.border} ${colors.bg} ring-2 ${colors.ring}`
                                            : 'border-gray-100 bg-white hover:border-gray-300'
                                        }`}
                                >
                                    {isSelected && (
                                        <div className={`absolute top-3 right-3 w-6 h-6 ${colors.bg} flex items-center justify-center rounded-full`}>
                                            <Check className={`w-4 h-4 ${colors.text}`} />
                                        </div>
                                    )}
                                    <div className={`w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center mb-4`}>
                                        <Icon className={`w-6 h-6 ${colors.text}`} />
                                    </div>
                                    <h3 className="font-bold text-sm text-gray-900 mb-1">{template.name}</h3>
                                    <p className="text-xs text-gray-500 leading-relaxed font-medium">{template.description}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
