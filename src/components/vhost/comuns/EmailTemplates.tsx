"use client";

import { useState } from "react";
import { X, LayoutTemplate, Newspaper, Megaphone, AlertTriangle, FileText, Check } from "lucide-react";

interface EmailTemplatesProps {
    onSelect: (html: string) => void;
    onClose: () => void;
    /** Logo a usar no cabeçalho dos templates. null/undefined -> mostra um placeholder ("O seu logótipo aqui"), usado enquanto uma conta revendedor/cliente/profissional ainda não enviou o logo da sua própria empresa. */
    brandLogoUrl?: string | null;
    brandLogoAlt?: string;
    /** Conta VisualDesign (admin) -> rodapé com os dados reais da empresa. Qualquer outra conta mantém os campos como texto editável ([Nome da Empresa], etc.), porque não temos os dados reais dela. */
    isAdminAccount?: boolean;
}

// Cores fixas dos cabeçalhos (barra sólida com o logótipo da empresa e, no
// canto oposto, os ícones de redes sociais).
const COLOR_BLACK = "#000000";
const COLOR_DARK_GREY = "#27272a";
const COLOR_LIGHT_GREY = "#71717a";
const COLOR_RED = "#dc2626";

// Logo por omissão da VisualDesign (contas admin) — horizontal, PNG
// transparente, texto a branco (pensado para fundos escuros/médios).
// Caminho relativo de propósito — resolve tanto no preview local (dev) como
// no painel em produção, sem depender de já ter sido feito deploy. O envio
// real (src/app/api/mailmarketing-send/route.ts) torna este caminho absoluto
// antes de despachar, porque um cliente de email não tem "origem" nenhuma
// para resolver um caminho relativo como o browser.
const VISUALDESIGN_LOGO_URL = "/assets/Logo_horizontal_branco.png";
const LOGO_NATIVE_WIDTH = 2241;
const LOGO_NATIVE_HEIGHT = 642;
const LOGO_DISPLAY_WIDTH = 200;
const LOGO_DISPLAY_HEIGHT = Math.round(LOGO_DISPLAY_WIDTH * (LOGO_NATIVE_HEIGHT / LOGO_NATIVE_WIDTH));

// Dados reais da VisualDesign para o rodapé por omissão (só quando
// isAdminAccount) — evita mandar "[Nome da Empresa]" por preencher em algo
// que já sai sempre da mesma conta. Fonte: src/components/seo/OrganizationJsonLd.tsx
// e src/app/contabilidade/fecho/[year]/page.tsx (mesmo NUIT usado na facturação).
const VISUALDESIGN_FOOTER_LINE1 = "VisualDESIGN Services, Lda. — Av. Karl Marx, 177, Maputo, Moçambique";
const VISUALDESIGN_FOOTER_LINE2 = "NUIT: 400597243 · info@visualdesignmoz.com · +258 82 528 8318";

// Regra de contraste da linha de destaque por cima do conteúdo: preto -> linha
// vermelha, vermelho -> linha preta. As restantes cores mantêm a linha igual
// ao cabeçalho (sem regra de contraste definida para elas).
const ACCENT_OVERRIDES: Record<string, string> = {
    [COLOR_BLACK]: COLOR_RED,
    [COLOR_RED]: COLOR_BLACK,
};
function accentFor(headerColor: string): string {
    return ACCENT_OVERRIDES[headerColor] || headerColor;
}

// Ícones de redes sociais (mesmo estilo circular que antes estava no rodapé).
function buildSocialIconsHtml(accent: string): string {
    return `<table cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="padding:0 3px;"><a href="#" style="display:inline-block;width:20px;height:20px;line-height:20px;border-radius:50%;background:${accent};color:#fff;font-size:10px;font-weight:800;text-decoration:none;text-align:center;">f</a></td>
                <td style="padding:0 3px;"><a href="#" style="display:inline-block;width:20px;height:20px;line-height:20px;border-radius:50%;background:${accent};color:#fff;font-size:10px;font-weight:800;text-decoration:none;text-align:center;">in</a></td>
                <td style="padding:0 3px;"><a href="#" style="display:inline-block;width:20px;height:20px;line-height:20px;border-radius:50%;background:${accent};color:#fff;font-size:10px;font-weight:800;text-decoration:none;text-align:center;">X</a></td>
              </tr></table>`;
}

// Cabeçalho partilhado por todos os templates: fundo esticado à largura
// total do email (sem margens laterais nem por cima — só o cabeçalho é
// "chapado", o cartão de conteúdo abaixo fica descolado e sem cantos
// arredondados), logótipo à esquerda e redes sociais no canto superior
// direito (width/height explícitos na imagem, necessário para o Outlook
// reservar o espaço certo antes de a imagem carregar).
function buildHeaderHtml(background: string, logoUrl: string | null | undefined, logoAlt: string): string {
    const accent = accentFor(background);
    const logoCell = logoUrl
        ? `<img src="${logoUrl}" alt="${logoAlt}" width="${LOGO_DISPLAY_WIDTH}" height="${LOGO_DISPLAY_HEIGHT}" style="display:block;width:${LOGO_DISPLAY_WIDTH}px;height:${LOGO_DISPLAY_HEIGHT}px;border:0;outline:none;text-decoration:none;" />`
        : `<span style="color:#ffffff;opacity:0.7;font-size:13px;font-weight:600;">[O seu logótipo aqui]</span>`;

    return `
  <!-- Cabeçalho: fundo e conteúdo à largura total, sem cartão nem margens. -->
  <tr>
    <td style="background:${background};">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="left" valign="middle" style="padding:16px 20px;">${logoCell}</td>
          <td align="right" valign="middle" style="padding:16px 20px;">${buildSocialIconsHtml(accent)}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

interface BrandInfo {
    logoUrl: string | null;
    logoAlt: string;
    isAdmin: boolean;
}

function footerCompanyLinesHtml(brand: BrandInfo, textColor: string, secondaryColor: string): string {
    if (brand.isAdmin) {
        return `<p style="color:${textColor};font-size:12px;margin:0 !important;line-height:1.2;">${VISUALDESIGN_FOOTER_LINE1}</p>
            <p style="color:${secondaryColor};font-size:11px;margin:3px 0 0 0 !important;line-height:1.2;">${VISUALDESIGN_FOOTER_LINE2}</p>`;
    }
    return `<p style="color:${textColor};font-size:12px;margin:0 !important;line-height:1.2;">[Nome da Empresa] - [Contacto]</p>`;
}

function buildTemplates(brand: BrandInfo) {
    return [
    {
        id: 'news',
        name: 'Notícia',
        description: 'Template para newsletter e comunicações regulares.',
        icon: Newspaper,
        color: 'black',
        html: () => {
            const accent = accentFor(COLOR_BLACK);
            return `
<!--
  CORES EDITÁVEIS:
  - Cor do cabeçalho: ${COLOR_BLACK} (preto)
  - Cor de destaque (linha, botões, ícones): ${accent} (vermelho)
  - Cor texto secundário dos blocos: #64748b (cinza)
-->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Exo 2',sans-serif;background-color:#f1f5f9;">
${buildHeaderHtml(COLOR_BLACK, brand.logoUrl, brand.logoAlt)}

  <!-- Cartão: descolado do cabeçalho, sem cantos arredondados, linha de destaque no topo -->
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-top:4px solid ${accent};">

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
              <a href="#" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:8px 20px;border-radius:6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Ler Mais</a>
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
          <td style="background:#f8fafc;padding:14px 24px;text-align:center;border-top:1px solid #e2e8f0;">
            ${footerCompanyLinesHtml(brand, '#64748b', '#94a3b8')}
            <p style="color:#94a3b8;font-size:11px;margin:3px 0 0 0 !important;line-height:1.2;">
              <a href="#" style="color:#64748b;text-decoration:underline;">Desinscrever-se</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`;
        }
    },
    {
        id: 'promo',
        name: 'Promoção',
        description: 'Template para campanhas promocionais e ofertas especiais.',
        icon: Megaphone,
        color: 'darkgrey',
        html: () => {
            const accent = accentFor(COLOR_DARK_GREY);
            return `
<!--
  CORES EDITÁVEIS:
  - Cor do cabeçalho e de destaque (bordas, botões): ${COLOR_DARK_GREY} (cinza escuro)
  - Cor de fundo info box: #f4f4f5 (cinza muito claro)
-->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Exo 2',sans-serif;background-color:#f1f5f9;">
${buildHeaderHtml(COLOR_DARK_GREY, brand.logoUrl, brand.logoAlt)}

  <!-- Cartão: descolado do cabeçalho, sem cantos arredondados, linha de destaque no topo -->
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-top:4px solid ${accent};">

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
                  <a href="#" style="display:inline-block;background-color:${accent} !important;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:500;mso-background-color:${accent};">Saber mais</a>
                </td>
              </tr>
            </table>

            <!-- Info adicional -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
              <tr>
                <td style="padding:20px;background-color:#f4f4f5 !important;border-radius:8px;border-left:4px solid ${accent};mso-background-color:#f4f4f5;">
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
          <td style="background:#f8fafc;padding:14px 24px;text-align:center;border-top:1px solid #e2e8f0;">
            ${footerCompanyLinesHtml(brand, '#64748b', '#94a3b8')}
            <p style="color:#94a3b8;font-size:11px;margin:3px 0 0 0 !important;line-height:1.2;">
              Se não deseja receber estas mensagens, pode <a href="#" style="color:#64748b;text-decoration:underline;">remover subscrição aqui</a>
            </p>
            ${brand.isAdmin ? '' : '<p style="color:#94a3b8;font-size:10px;margin:2px 0 0 0 !important;line-height:1.2;">[Morada da empresa] | NIF: [NIF]</p>'}
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`;
        }
    },
    {
        id: 'alert',
        name: 'Alerta',
        description: 'Template para avisos e comunicados importantes.',
        icon: AlertTriangle,
        color: 'lightgrey',
        html: () => {
            const accent = accentFor(COLOR_LIGHT_GREY);
            return `
<!--
  CORES EDITÁVEIS:
  - Cor do cabeçalho e de destaque (linha, botão): ${COLOR_LIGHT_GREY} (cinza claro)
  - Cor de fundo da caixa de resumo: #f4f4f5 (cinza muito claro)
-->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Exo 2',sans-serif;background-color:#f1f5f9;">
${buildHeaderHtml(COLOR_LIGHT_GREY, brand.logoUrl, brand.logoAlt)}

  <!-- Cartão: descolado do cabeçalho, sem cantos arredondados, linha de destaque no topo -->
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-top:4px solid ${accent};">

        <!-- Body -->
        <tr>
          <td style="padding:32px 24px;">
            <p style="color:${accent};font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px 0;">ℹ️ Comunicado Importante</p>
            <div style="background:#f4f4f5;border-left:4px solid ${accent};padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
              <p style="color:#3f3f46;font-size:14px;font-weight:700;margin:0;">Resumo</p>
              <p style="color:#52525b;font-size:13px;line-height:1.6;margin:8px 0 0 0;">[Breve descrição do objectivo deste comunicado.]</p>
            </div>

            <h3 style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 12px 0;">[Título do Assunto]</h3>
            <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 16px 0;">
              [Conteúdo detalhado da comunicação. Explique o que mudou, o que o destinatário precisa de saber ou que acção tomar.]
            </p>

            <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 24px 0;">
              [Segundo parágrafo com informações adicionais, se necessário.]
            </p>

            <a href="#" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:10px 28px;border-radius:6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Saber Mais</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:14px 24px;text-align:center;border-top:1px solid #e2e8f0;">
            ${footerCompanyLinesHtml(brand, '#64748b', '#94a3b8')}
            <p style="color:#94a3b8;font-size:11px;margin:3px 0 0 0 !important;line-height:1.2;">
              <a href="#" style="color:#64748b;text-decoration:underline;">Desinscrever-se</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`;
        }
    },
    {
        id: 'blank',
        name: 'Em Branco',
        description: 'Apenas cabeçalho preto e rodapé cinza, para desenhar a mensagem do zero.',
        icon: FileText,
        color: 'blank',
        html: () => {
            const accent = accentFor(COLOR_BLACK);
            return `
<!--
  CORES EDITÁVEIS:
  - Cor do cabeçalho: ${COLOR_BLACK} (preto)
  - Cor de destaque (linha): ${accent} (vermelho)
  - Cor de fundo do rodapé: #e4e4e7 (cinza)
-->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Exo 2',sans-serif;background-color:#f1f5f9;">
${buildHeaderHtml(COLOR_BLACK, brand.logoUrl, brand.logoAlt)}

  <!-- Cartão: descolado do cabeçalho, sem cantos arredondados, linha de destaque no topo -->
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-top:4px solid ${accent};">

        <!-- Body: em branco, para escrever a mensagem do zero -->
        <tr>
          <td style="padding:32px 24px;">
            <h2 style="color:#1e293b;font-size:20px;font-weight:800;margin:0 0 8px 0;">[Título]</h2>
            <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0;">[Escreva aqui o conteúdo da sua mensagem...]</p>
          </td>
        </tr>

        <!-- Footer: cinza, editável -->
        <tr>
          <td style="background:#e4e4e7;padding:14px 24px;text-align:center;border-top:1px solid #d4d4d8;">
            ${footerCompanyLinesHtml(brand, '#3f3f46', '#52525b')}
            <p style="color:#52525b;font-size:11px;margin:3px 0 0 0 !important;line-height:1.2;">
              <a href="#" style="color:#3f3f46;text-decoration:underline;">Desinscrever-se</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`;
        }
    },
    ];
}

export function EmailTemplates({ onSelect, onClose, brandLogoUrl, brandLogoAlt, isAdminAccount = true }: EmailTemplatesProps) {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const brand: BrandInfo = isAdminAccount
        ? { logoUrl: VISUALDESIGN_LOGO_URL, logoAlt: 'VisualDesign', isAdmin: true }
        : { logoUrl: brandLogoUrl ?? null, logoAlt: brandLogoAlt || 'Logótipo da empresa', isAdmin: false };
    const templates = buildTemplates(brand);

    const colorMap: Record<string, { bg: string; border: string; text: string; ring: string }> = {
        black: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', ring: 'ring-red-500' },
        darkgrey: { bg: 'bg-zinc-100', border: 'border-zinc-300', text: 'text-zinc-700', ring: 'ring-zinc-500' },
        lightgrey: { bg: 'bg-zinc-50', border: 'border-zinc-200', text: 'text-zinc-500', ring: 'ring-zinc-400' },
        blank: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', ring: 'ring-slate-500' },
    };

    const handleSelect = (html: string) => {
        onSelect(html);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-800 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between bg-gray-50 dark:bg-zinc-800/60">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-950/30 rounded-lg flex items-center justify-center">
                            <LayoutTemplate className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800 dark:text-white tracking-wider">Escolher Template</h2>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">Clique num template para aplicar automaticamente</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors group">
                        <X className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-zinc-300" />
                    </button>
                </div>

                {/* Templates Grid */}
                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {templates.map((template) => {
                            const colors = colorMap[template.color];
                            const isSelected = selectedId === template.id;
                            const Icon = template.icon;

                            return (
                                <button
                                    key={template.id}
                                    onClick={() => handleSelect(template.html())}
                                    className={`relative text-left p-5 rounded-lg border-2 transition-all hover:shadow-sm ${isSelected
                                            ? `${colors.border} ${colors.bg} ring-2 ${colors.ring}`
                                            : 'border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-gray-300 dark:hover:border-zinc-600'
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
                                    <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1">{template.name}</h3>
                                    <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed font-medium">{template.description}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
