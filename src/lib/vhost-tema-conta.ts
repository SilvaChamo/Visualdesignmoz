// Tema do painel VisualHost de cada conta (claro/escuro, cores, cantos e marca): a validação que a rota
// /api/vhost/tema-conta usa ao ler e gravar, e o cookie com o tema da própria conta que a página do painel lê no
// servidor — ao recarregar, o painel vem logo com as cores da conta, sem passar pelo tema de origem (claro) enquanto
// o servidor responde: era a "tela branca" de quem usa o tema escuro (Silva, 16/10/2026).
// Sem dependências de servidor: usado também pelo painel no navegador.

const CORES = ['primary', 'safe', 'danger', 'warning', 'railBg', 'railInk', 'botoes'] as const;
type Cor = (typeof CORES)[number];

export type TemaConta = {
  theme: 'light' | 'dark';
  colorPreset: string;
  customPrimary: string;
  /** cores mudadas à mão em cada tema de cores */
  themeOver: Record<string, Partial<Record<Cor, string>>>;
  radius: string;
  brand: { name: string; logo: string };
};

const HEX = /^#[0-9a-f]{6}$/i;
const PRESET = /^[a-z0-9_-]{1,40}$/i;

/** Valida um tema guardado (ficheiro do servidor, pedido, cookie ou navegador); null se não for válido */
export function lerTema(valor: unknown): TemaConta | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const v = valor as Record<string, unknown>;
  if (v.theme !== 'light' && v.theme !== 'dark') return null;
  if (typeof v.colorPreset !== 'string' || !PRESET.test(v.colorPreset)) return null;
  if (typeof v.customPrimary !== 'string' || (v.customPrimary && !HEX.test(v.customPrimary))) return null;
  if (typeof v.radius !== 'string' || !/^\d{1,2}px$/.test(v.radius)) return null;
  if (!v.brand || typeof v.brand !== 'object' || Array.isArray(v.brand)) return null;
  const brand = v.brand as Record<string, unknown>;
  if (typeof brand.name !== 'string' || brand.name.length > 120) return null;
  if (typeof brand.logo !== 'string' || brand.logo.length > 300_000) return null;

  const themeOver: TemaConta['themeOver'] = {};
  if (v.themeOver && typeof v.themeOver === 'object' && !Array.isArray(v.themeOver)) {
    for (const [preset, values] of Object.entries(v.themeOver as Record<string, unknown>)) {
      if (!PRESET.test(preset) || !values || typeof values !== 'object' || Array.isArray(values)) continue;
      const cores = Object.fromEntries(
        Object.entries(values as Record<string, unknown>).filter(
          ([key, color]) => (CORES as readonly string[]).includes(key) && typeof color === 'string' && HEX.test(color),
        ),
      ) as Partial<Record<Cor, string>>;
      if (Object.keys(cores).length) themeOver[preset] = cores;
    }
  }

  return {
    theme: v.theme,
    colorPreset: v.colorPreset,
    customPrimary: v.customPrimary.toUpperCase(),
    themeOver,
    radius: v.radius,
    brand: { name: brand.name, logo: brand.logo },
  };
}

/** Cookie com o tema da própria conta (sem o logótipo, que não cabe num cookie) */
export const COOKIE_TEMA = 'vh-tema';
const CONTA = /^[a-z0-9._-]{1,64}$/i;
const MAX_COOKIE = 3000;

/** Valor do cookie: a conta e o tema dela; com muitas cores mudadas, só as do tema de cores em uso */
export function valorCookieTema(conta: string, tema: TemaConta): string {
  const t = { ...tema, brand: { name: tema.brand.name, logo: '' } };
  let valor = encodeURIComponent(JSON.stringify({ u: conta, t }));
  if (valor.length > MAX_COOKIE) {
    const over = tema.themeOver[tema.colorPreset];
    valor = encodeURIComponent(JSON.stringify({ u: conta, t: { ...t, themeOver: over ? { [tema.colorPreset]: over } : {} } }));
  }
  return valor;
}

/** Lê o cookie (já sem o encodeURIComponent, como o cookies() do Next o devolve): a conta e o tema, ou null */
export function temaDoCookie(valor: string | undefined): { conta: string; tema: TemaConta } | null {
  if (!valor) return null;
  try {
    const j = JSON.parse(valor) as { u?: unknown; t?: unknown };
    const tema = lerTema(j.t);
    if (!tema || typeof j.u !== 'string' || !CONTA.test(j.u)) return null;
    return { conta: j.u, tema: { ...tema, brand: { name: tema.brand.name, logo: '' } } };
  } catch {
    return null;
  }
}
