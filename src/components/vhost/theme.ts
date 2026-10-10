export interface ThemePreset {
  id: string;
  name: string;
  brandBadge?: string;
  tagline?: string;
  primary: string;
  dark: string;
  tint: string;
  tintDark: string;
  accent: string;
  railBg: string;
  railBgDark: string;
  railOn: string;
  railHov: string;
  railInk: string;
  railInkHover: string;
  railInkOn: string;
  description: string;
}

export interface CustomComponents {
  primary?: string;
  safe?: string;
  danger?: string;
  warning?: string;
  railBg?: string;
  railInk?: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'visualdesign',
    name: 'Vermelho',
    brandBadge: 'VERMELHO',
    tagline: 'Design que comunica. Ideias que impressionam.',
    primary: '#E5202E',
    dark: '#C21722',
    tint: '#FFF1F2',
    tintDark: '#3a1d22',
    accent: '#E5202E',
    railBg: '#8C0E17',
    railBgDark: '#2A090C',
    railOn: '#A0121C',
    railHov: '#901018',
    railInk: '#FFFFFF',
    railInkHover: '#FFFFFF',
    railInkOn: '#FFFFFF',
    description: 'Barra lateral compacta em tom vermelho profundo e sólido.',
  },
  {
    id: 'white_red',
    name: 'Branco e Vermelho',
    brandBadge: 'BRANCO & RED',
    tagline: 'Barra lateral em branco puro com destaques e botões em vermelho.',
    primary: '#E5202E',
    dark: '#C21722',
    tint: '#F4F4F5',
    tintDark: '#27272A',
    accent: '#E5202E',
    railBg: '#FFFFFF',
    railBgDark: '#2e0b0e',
    railOn: '#FFF1F2',
    railHov: '#FAFAFA',
    railInk: '#42454D',
    railInkHover: '#E5202E',
    railInkOn: '#E5202E',
    description: 'Barra lateral compacta em 100% branco puro com destaque em vermelho.',
  },
  {
    id: 'black_red',
    name: 'Preto e Vermelho',
    brandBadge: 'PRETO & RED',
    tagline: 'Poder, elegância e contraste alto com destaque vermelho.',
    primary: '#E5202E',
    dark: '#C21722',
    tint: '#F4F4F5',
    tintDark: '#27272A',
    accent: '#E5202E',
    railBg: '#18181B',
    railBgDark: '#180608',
    railOn: '#27272A',
    railHov: '#202023',
    railInk: '#FAFAFA',
    railInkHover: '#E5202E',
    railInkOn: '#E5202E',
    description: 'Barra lateral em preto nobre 100% sólido com destaques em vermelho.',
  },
  {
    id: 'gray_red',
    name: 'Cinza e Vermelho',
    brandBadge: 'CINZA & RED',
    tagline: 'Sobriedade metálica do cinza titânio com a força do vermelho.',
    primary: '#E5202E',
    dark: '#C21722',
    tint: '#F4F4F5',
    tintDark: '#22242A',
    accent: '#E5202E',
    railBg: '#3F3F46',
    railBgDark: '#220e11',
    railOn: '#52525B',
    railHov: '#4A4A52',
    railInk: '#FFFFFF',
    railInkHover: '#FFFFFF',
    railInkOn: '#FFFFFF',
    description: 'Barra lateral em cinza titânio com ícones e destaques em vermelho.',
  },
  {
    id: 'visualeventos',
    name: 'Turquesa (Eventos)',
    brandBadge: 'EVENTOS',
    tagline: 'Criamos experiências que ficam na memória.',
    primary: '#00A8B5',
    dark: '#008692',
    tint: '#F0FDFA',
    tintDark: '#0d383b',
    accent: '#00A8B5',
    railBg: '#005B63',
    railBgDark: '#032529',
    railOn: '#00727C',
    railHov: '#006770',
    railInk: '#FFFFFF',
    railInkHover: '#FFFFFF',
    railInkOn: '#FFFFFF',
    description: 'Barra lateral em tom turquesa profundo e opaco.',
  },
  {
    id: 'visualweb',
    name: 'Verde (Web)',
    brandBadge: 'WEB',
    tagline: 'Sites que conectam e transformam.',
    primary: '#10B981',
    dark: '#059669',
    tint: '#ECFDF5',
    tintDark: '#0b3628',
    accent: '#10B981',
    railBg: '#076646',
    railBgDark: '#04261b',
    railOn: '#097F57',
    railHov: '#08734F',
    railInk: '#FFFFFF',
    railInkHover: '#FFFFFF',
    railInkOn: '#FFFFFF',
    description: 'Barra lateral em verde intenso e profundo.',
  },
  {
    id: 'visualtransporte',
    name: 'Roxo (Transporte)',
    brandBadge: 'TRANSPORTE',
    tagline: 'Transportamos com segurança. Entregamos confiança.',
    primary: '#651FFF',
    dark: '#5000D6',
    tint: '#F5F3FF',
    tintDark: '#230a54',
    accent: '#651FFF',
    railBg: '#3900B3',
    railBgDark: '#17053B',
    railOn: '#4600DB',
    railHov: '#3E00C4',
    railInk: '#FFFFFF',
    railInkHover: '#FFFFFF',
    railInkOn: '#FFFFFF',
    description: 'Barra lateral em tom roxo purpúreo profundo com ícones brancos.',
  },
  {
    id: 'visualpro',
    name: 'Azul (Pro)',
    brandBadge: 'PRO',
    tagline: 'Soluções visuais e criativas para si.',
    primary: '#0055D4',
    dark: '#0040A8',
    tint: '#EFF6FF',
    tintDark: '#0d234a',
    accent: '#0055D4',
    railBg: '#0B2545',
    railBgDark: '#07182E',
    railOn: '#133866',
    railHov: '#0F2F57',
    railInk: '#FFFFFF',
    railInkHover: '#FFFFFF',
    railInkOn: '#FFFFFF',
    description: 'Barra lateral compacta em tom azul marinho profundo ("mais carregado").',
  },
  {
    id: 'white',
    name: 'Branco Puro',
    brandBadge: 'BRANCO PURO',
    tagline: 'Design ultra-clean e luminoso em 100% branco puro.',
    primary: '#18181B',
    dark: '#09090B',
    tint: '#F4F4F5',
    tintDark: '#27272A',
    accent: '#18181B',
    railBg: '#FFFFFF',
    railBgDark: '#18181B',
    railOn: '#F4F4F5',
    railHov: '#FAFAFA',
    railInk: '#42454D',
    railInkHover: '#18181B',
    railInkOn: '#18181B',
    description: 'Barra lateral compacta em 100% branco puro (#FFFFFF).',
  },
  {
    id: 'puro_black',
    name: 'Puro Black',
    brandBadge: 'PURO BLACK',
    tagline: 'Fundo 100% preto puro (#000000) absoluto.',
    primary: '#000000',
    dark: '#000000',
    tint: '#18181B',
    tintDark: '#09090B',
    accent: '#000000',
    railBg: '#000000',
    railBgDark: '#000000',
    railOn: '#18181B',
    railHov: '#111113',
    railInk: '#FFFFFF',
    railInkHover: '#FFFFFF',
    railInkOn: '#FFFFFF',
    description: 'Barra lateral compacta em 100% preto puro absoluto (#000000).',
  },
  {
    id: 'black',
    name: 'Obsidian Black',
    brandBadge: 'OBSIDIAN BLACK',
    tagline: 'Elegância e mistério em preto profundo.',
    primary: '#18181B',
    dark: '#09090B',
    tint: '#F4F4F5',
    tintDark: '#27272A',
    accent: '#18181B',
    railBg: '#18181B',
    railBgDark: '#121214',
    railOn: '#27272A',
    railHov: '#202023',
    railInk: '#FFFFFF',
    railInkHover: '#FFFFFF',
    railInkOn: '#FFFFFF',
    description: 'Estilo executivo em preto 100% absoluto com ícones brancos.',
  },
  {
    id: 'gray',
    name: 'Cinza Suave',
    brandBadge: 'CINZA',
    tagline: 'Fundo cinza suave clássico e limpo da maquete original.',
    primary: '#475569',
    dark: '#334155',
    tint: '#F8FAFC',
    tintDark: '#1c1e24',
    accent: '#475569',
    railBg: '#2A3441',
    railBgDark: '#1c1e24',
    railOn: '#3A4657',
    railHov: '#333F50',
    railInk: '#FFFFFF',
    railInkHover: '#FFFFFF',
    railInkOn: '#FFFFFF',
    description: 'Barra lateral compacta em tom cinza suave e sóbrio.',
  },
];

/** Converte hex (#RRGGBB) para valores R, G, B */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

/** Escurece uma cor hex para hover */
export function darkenHex(hex: string, percent = 18): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = (100 - percent) / 100;
  const r = Math.max(0, Math.floor(rgb.r * factor)).toString(16).padStart(2, '0');
  const g = Math.max(0, Math.floor(rgb.g * factor)).toString(16).padStart(2, '0');
  const b = Math.max(0, Math.floor(rgb.b * factor)).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export function blendWithWhiteHex(hex: string, alpha = 0.12): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#EBEBEF';
  const r = Math.round(rgb.r * alpha + 255 * (1 - alpha)).toString(16).padStart(2, '0');
  const g = Math.round(rgb.g * alpha + 255 * (1 - alpha)).toString(16).padStart(2, '0');
  const b = Math.round(rgb.b * alpha + 255 * (1 - alpha)).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export function getThemeColors(
  presetId: string,
  customPrimary?: string,
  customComponents?: CustomComponents,
): {
  primary: string;
  dark: string;
  tint: string;
  tintDark: string;
  accent: string;
  safe: string;
  danger: string;
  warning: string;
  railBg: string;
  railBgDark: string;
  railOn: string;
  railHov: string;
  railInk: string;
  railInkHover: string;
  railInkOn: string;
} {
  const normalizedId = presetId === 'red' ? 'visualdesign' : presetId === 'blue' ? 'visualpro' : presetId;
  const preset = THEME_PRESETS.find((p) => p.id === normalizedId) || THEME_PRESETS[0];

  let primary = customComponents?.primary || (presetId === 'custom' && customPrimary ? customPrimary : preset.primary);
  let dark = darkenHex(primary, 18);
  let safe = customComponents?.safe || '#1C9D5B';
  let danger = customComponents?.danger || '#E5202E';
  let warning = customComponents?.warning || '#FBBF24';
  let railBg = customComponents?.railBg || (presetId === 'custom' && customPrimary ? customPrimary : preset.railBg);
  let railOn = darkenHex(railBg, 15);
  let railHov = darkenHex(railBg, 10);
  let railInk = customComponents?.railInk || preset.railInk || '#FFFFFF';

  let tint = preset.tint;
  let tintDark = preset.tintDark;

  if (customComponents?.railBg || customComponents?.primary) {
    const c = customComponents.railBg && customComponents.railBg !== '#FFFFFF' && customComponents.railBg !== '#000000' && customComponents.railBg !== '#18181B'
      ? customComponents.railBg
      : primary;
    const rgb = hexToRgb(c);
    tint = blendWithWhiteHex(c, 0.08);
    tintDark = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)` : preset.tintDark;
  }

  return {
    primary,
    dark,
    tint,
    tintDark,
    accent: primary,
    safe,
    danger,
    warning,
    railBg,
    railBgDark: preset.railBgDark || '#09090B',
    railOn,
    railHov,
    railInk,
    railInkHover: preset.railInkHover || '#FFFFFF',
    railInkOn: preset.railInkOn || '#FFFFFF',
  };
}

/** Contador de mensagens na barra de ícones: vermelho sobre uma barra da mesma cor deixa de se ver → fundo branco */
export function badgeColors(railBg: string, primary: string): { bg: string; ink: string } | null {
  const lum = (hex: string) => {
    const c = hexToRgb(hex);
    if (!c) return 0;
    const [r, g, b] = [c.r, c.g, c.b].map((x) => {
      const v = x / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(railBg), lum(primary)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05) < 1.8 ? { bg: '#FFFFFF', ink: primary } : null;
}

export const isHex = (c?: string): c is string => !!c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());
