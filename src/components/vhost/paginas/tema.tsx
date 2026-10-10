'use client';

import { useState, useEffect, useRef } from 'react';
import { useVH } from '../context';
import { THEME_PRESETS, getThemeColors, isHex, type CustomComponents } from '../theme';
import { LOGO, route, type St } from '../state';

/** Onde a página está aberta: em Preferências → Aparência (todas as contas) ou no menu do painel (Admin/Revenda) */
export const temaBase = (s: St) => (s.page === 'preferencias' ? '/preferencias/aparencia' : route(s.level, 'tema'));

type Cores = { primary: string; safe: string; danger: string; warning: string; railBg: string; railInk: string };
const CHAVES: (keyof Cores)[] = ['primary', 'safe', 'danger', 'warning', 'railBg', 'railInk'];
const coresDe = (c: ReturnType<typeof getThemeColors>): Cores => ({ primary: c.primary, safe: c.safe, danger: c.danger, warning: c.warning, railBg: c.railBg, railInk: c.railInk });

export function ThemeCustomizerView() {
  const vh = useVH();
  const { s, t, nav, setColorPreset, saveThemeColors, previewThemeColors, toggleTheme, setRadius, setBrand, toast } = vh;

  const basePath = temaBase(s);
  const sub0 = s.sub[0] || 'menu';
  const sub1 = s.sub[1] || 'all';

  const activePreset = s.colorPreset || 'visualdesign';
  const activeRadius = s.radius || '4px';
  const isCustom = activePreset === 'custom';
  const [customHex, setCustomHex] = useState(s.customPrimary || '#E5202E');

  // Marca (guardada no navegador; o logótipo aparece na barra de ícones e no topo do telemóvel)
  const [brandName, setBrandName] = useState(s.brand.name || 'VisualHost');
  const [logoUrl, setLogoUrl] = useState(s.brand.logo);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cores mudadas à mão: ficam guardadas em cada tema (escolher outro tema e voltar não as perde)
  const guardadas = s.themeOver[activePreset];
  const currentColors = getThemeColors(activePreset, s.customPrimary, s.themePreview || guardadas);
  const doTema = coresDe(getThemeColors(activePreset, s.customPrimary));

  // Estado local para o Editor de Componentes (Estilo V-Host Colors)
  const [compColors, setCompColors] = useState<Cores>(() => coresDe(currentColors));
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

  // mudou de tema ou guardou → o editor mostra as cores guardadas desse tema
  useEffect(() => {
    setCompColors(coresDe(getThemeColors(activePreset, s.customPrimary, s.themeOver[activePreset])));
  }, [activePreset, s.customPrimary, s.themeOver]);
  // ao sair da página sem guardar, o painel volta às cores guardadas
  const limpar = useRef(previewThemeColors);
  limpar.current = previewThemeColors;
  useEffect(() => () => limpar.current(null), []);

  /** só se guarda o que é diferente das cores do tema */
  const diferentes = (c: Cores): CustomComponents =>
    Object.fromEntries(CHAVES.filter((k) => isHex(c[k]) && c[k].toUpperCase() !== doTema[k].toUpperCase()).map((k) => [k, c[k]]));
  const porGuardar = JSON.stringify(diferentes(compColors)) !== JSON.stringify(guardadas || {});

  const handleCompColorChange = (key: keyof Cores, val: string) => {
    const next = { ...compColors, [key]: val };
    setCompColors(next);
    if (isHex(val)) previewThemeColors(diferentes(next));
  };

  const handleUndoCompColors = () => {
    setCompColors(doTema);
    saveThemeColors(null);
  };

  const handleSaveCompColors = () => {
    const d = diferentes(compColors);
    saveThemeColors(Object.keys(d).length ? d : null);
  };

  const handleCustomSubmit = (hex: string) => {
    setCustomHex(hex);
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) setColorPreset('custom', hex.toUpperCase());
  };

  const carregarLogo = (f?: File) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(f.type)) return toast('Escolha uma imagem PNG, JPG, SVG ou WebP');
    if (f.size > 200 * 1024) return toast('A imagem tem de ter menos de 200 KB');
    const r = new FileReader();
    r.onload = () => setLogoUrl(String(r.result));
    r.readAsDataURL(f);
  };

  return (
    <div className="tema-pg">
      {/* NÍVEL 1: MENU PRINCIPAL DE CATEGORIAS (DirectAdmin Customize Skin Categories) */}
      {sub0 === 'menu' && (
        <div>
          <div
            style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r)',
              padding: '20px 24px',
              marginBottom: '24px',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px' }}>
              {t('Categorias de Personalização do Painel')}
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: 0 }}>
              {t('Selecione uma categoria para personalizar os componentes visuais, cores, layout ou marca do painel (como no DirectAdmin).')}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
              marginBottom: '24px',
            }}
          >
            {/* Categoria 1: Cores dos Componentes */}
            <div
              onClick={() => nav(basePath + '/cores')}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: 'calc(var(--r) + 2px)',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--r)',
                    background: 'var(--tint)',
                    color: 'var(--red)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 20,
                  }}
                >
                  <i className="fa-solid fa-palette" />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--ink)' }}>
                    {t('Cores dos Componentes')}
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase' }}>
                    V-Host Colors
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.4, margin: '0 0 16px' }}>
                {t('Temas das marcas Visual, editor de cores de componentes (Primary, Safe, Danger, Warning, Barra Compacta e Ícones).')}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>
                <span>{t('Explorar Cores')}</span>
                <i className="fa-solid fa-arrow-right" style={{ fontSize: 11 }} />
              </div>
            </div>

            {/* Categoria 2: Layout & Estrutura */}
            <div
              onClick={() => nav(basePath + '/layout')}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: 'calc(var(--r) + 2px)',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--r)',
                    background: 'var(--soft)',
                    color: 'var(--ink)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 20,
                  }}
                >
                  <i className="fa-solid fa-shapes" />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--ink)' }}>
                    {t('Layout & Cantos')}
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                    Layout & Radius
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.4, margin: '0 0 16px' }}>
                {t('Ajuste a intensidade das curvas dos painéis (Border Radius: 4px padrão) e estrutura visual.')}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>
                <span>{t('Ajustar Layout')}</span>
                <i className="fa-solid fa-arrow-right" style={{ fontSize: 11 }} />
              </div>
            </div>

            {/* Categoria 3: Modo de Exibição */}
            <div
              onClick={() => nav(basePath + '/aparencia')}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: 'calc(var(--r) + 2px)',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--r)',
                    background: 'var(--soft)',
                    color: 'var(--ink)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 20,
                  }}
                >
                  <i className="fa-solid fa-circle-half-stroke" />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--ink)' }}>
                    {t('Modo de Exibição')}
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                    Light / Dark
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.4, margin: '0 0 16px' }}>
                {t('Alterne entre os modos Claro e Escuro para um maior conforto visual.')}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>
                <span>{t('Alterar Modo')}</span>
                <i className="fa-solid fa-arrow-right" style={{ fontSize: 11 }} />
              </div>
            </div>

            {/* Categoria 4: Marca & Logótipo */}
            <div
              onClick={() => nav(basePath + '/marca')}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: 'calc(var(--r) + 2px)',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--r)',
                    background: 'var(--soft)',
                    color: 'var(--ink)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 20,
                  }}
                >
                  <i className="fa-solid fa-font" />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--ink)' }}>
                    {t('Marca & Logótipo')}
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                    Branding
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.4, margin: '0 0 16px' }}>
                {t('Defina o nome do serviço, URL do logótipo da sua empresa e dados de rodapé.')}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>
                <span>{t('Definir Marca')}</span>
                <i className="fa-solid fa-arrow-right" style={{ fontSize: 11 }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NÍVEL 2: CATEGORIA CORES DOS COMPONENTES (Skin Colors) */}
      {sub0 === 'cores' && (
        <div>
          {/* Sub-separadores de Cores */}
          <div className="lvl" style={{ marginBottom: 24, background: 'var(--card)', borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
            <button className={sub1 === 'all' ? 'on' : ''} onClick={() => nav(basePath + '/cores')}>
              Tudo
            </button>
            <button className={sub1 === 'presets' ? 'on' : ''} onClick={() => nav(basePath + '/cores/presets')}>
              Temas das Marcas
            </button>
            <button className={sub1 === 'editor' ? 'on' : ''} onClick={() => nav(basePath + '/cores/editor')}>
              Editor V-Host Colors
            </button>
            <button className={sub1 === 'custom_hex' ? 'on' : ''} onClick={() => nav(basePath + '/cores/custom_hex')}>
              Hex Personalizado
            </button>
          </div>

          {/* Subsecção: Editor V-Host Colors */}
          {(sub1 === 'all' || sub1 === 'editor') && (
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r)',
                padding: '22px 24px',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fa-solid fa-sliders" style={{ color: 'var(--red)' }} />
                    {t('Editor de Cores dos Componentes (V-Host Colors)')}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
                    {t('Ajuste individualmente a cor de cada componente do painel conforme o seu esquema pretendido.')}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {porGuardar && <span className="tag w">{t('Por guardar')}</span>}
                  {!porGuardar && guardadas && <span className="tag ok">{t('Guardado neste tema')}</span>}
                  <button
                    className="btn"
                    style={{ background: '#EA580C', color: '#fff', border: 'none', height: 36, padding: '0 14px', fontWeight: 700, fontSize: 12.5 }}
                    onClick={handleUndoCompColors}
                  >
                    <i className="fa-solid fa-rotate-left" />
                    {t('DESFAZER ALTERAÇÕES')}
                  </button>
                  <button
                    className="btn"
                    style={{ background: '#16A34A', color: '#fff', border: 'none', height: 36, padding: '0 16px', fontWeight: 700, fontSize: 12.5 }}
                    onClick={handleSaveCompColors}
                    disabled={!porGuardar}
                  >
                    <i className="fa-solid fa-floppy-disk" />
                    {t('GUARDAR ALTERAÇÕES')}
                  </button>
                </div>
              </div>

              {/* Grelha de Componentes Editáveis */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {/* Componente: Primary */}
                <div style={{ background: 'var(--soft)', padding: 14, borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>
                    Primary (Cor Principal do Painel)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={compColors.primary}
                      onChange={(e) => handleCompColorChange('primary', e.target.value)}
                      style={{ width: 40, height: 36, border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                    />
                    <input
                      type="text"
                      value={compColors.primary}
                      onChange={(e) => handleCompColorChange('primary', e.target.value)}
                      style={{ flex: 1, height: 36, border: '1px solid var(--line)', borderRadius: 4, padding: '0 10px', fontSize: 13, fontWeight: 700, background: 'var(--card)', color: 'var(--ink)' }}
                    />
                  </div>
                </div>

                {/* Componente: Safe */}
                <div style={{ background: 'var(--soft)', padding: 14, borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>
                    Safe (Sucesso / Operações Ok)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={compColors.safe}
                      onChange={(e) => handleCompColorChange('safe', e.target.value)}
                      style={{ width: 40, height: 36, border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                    />
                    <input
                      type="text"
                      value={compColors.safe}
                      onChange={(e) => handleCompColorChange('safe', e.target.value)}
                      style={{ flex: 1, height: 36, border: '1px solid var(--line)', borderRadius: 4, padding: '0 10px', fontSize: 13, fontWeight: 700, background: 'var(--card)', color: 'var(--ink)' }}
                    />
                  </div>
                </div>

                {/* Componente: Danger */}
                <div style={{ background: 'var(--soft)', padding: 14, borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>
                    Danger (Erro / Apagar)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={compColors.danger}
                      onChange={(e) => handleCompColorChange('danger', e.target.value)}
                      style={{ width: 40, height: 36, border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                    />
                    <input
                      type="text"
                      value={compColors.danger}
                      onChange={(e) => handleCompColorChange('danger', e.target.value)}
                      style={{ flex: 1, height: 36, border: '1px solid var(--line)', borderRadius: 4, padding: '0 10px', fontSize: 13, fontWeight: 700, background: 'var(--card)', color: 'var(--ink)' }}
                    />
                  </div>
                </div>

                {/* Componente: Warning */}
                <div style={{ background: 'var(--soft)', padding: 14, borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>
                    Warning (Aviso / Alertas)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={compColors.warning}
                      onChange={(e) => handleCompColorChange('warning', e.target.value)}
                      style={{ width: 40, height: 36, border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                    />
                    <input
                      type="text"
                      value={compColors.warning}
                      onChange={(e) => handleCompColorChange('warning', e.target.value)}
                      style={{ flex: 1, height: 36, border: '1px solid var(--line)', borderRadius: 4, padding: '0 10px', fontSize: 13, fontWeight: 700, background: 'var(--card)', color: 'var(--ink)' }}
                    />
                  </div>
                </div>

                {/* Componente: Rail Background */}
                <div style={{ background: 'var(--soft)', padding: 14, borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>
                    Rail Background (Fundo 100% da Barra Compacta)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={compColors.railBg}
                      onChange={(e) => handleCompColorChange('railBg', e.target.value)}
                      style={{ width: 40, height: 36, border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                    />
                    <input
                      type="text"
                      value={compColors.railBg}
                      onChange={(e) => handleCompColorChange('railBg', e.target.value)}
                      style={{ flex: 1, height: 36, border: '1px solid var(--line)', borderRadius: 4, padding: '0 10px', fontSize: 13, fontWeight: 700, background: 'var(--card)', color: 'var(--ink)' }}
                    />
                  </div>
                </div>

                {/* Componente: Rail Icon Color */}
                <div style={{ background: 'var(--soft)', padding: 14, borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>
                    Rail Icon Color (Cor dos Ícones da Barra Compacta)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={compColors.railInk}
                      onChange={(e) => handleCompColorChange('railInk', e.target.value)}
                      style={{ width: 40, height: 36, border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                    />
                    <input
                      type="text"
                      value={compColors.railInk}
                      onChange={(e) => handleCompColorChange('railInk', e.target.value)}
                      style={{ flex: 1, height: 36, border: '1px solid var(--line)', borderRadius: 4, padding: '0 10px', fontSize: 13, fontWeight: 700, background: 'var(--card)', color: 'var(--ink)' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-secção: Temas das Marcas */}
          {(sub1 === 'all' || sub1 === 'presets') && (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-palette" style={{ color: 'var(--red)' }} />
                {t('Temas de Cores')}
              </h3>

              {(() => {
                const row1Presets = ['visualdesign', 'black_red', 'gray_red', 'white_red']
                  .map((id) => THEME_PRESETS.find((p) => p.id === id))
                  .filter((p): p is import('../theme').ThemePreset => !!p);
                const row2Presets = ['visualeventos', 'visualweb', 'visualtransporte', 'visualpro']
                  .map((id) => THEME_PRESETS.find((p) => p.id === id))
                  .filter((p): p is import('../theme').ThemePreset => !!p);
                const row3Presets = ['puro_black', 'black', 'gray', 'white']
                  .map((id) => THEME_PRESETS.find((p) => p.id === id))
                  .filter((p): p is import('../theme').ThemePreset => !!p);

                const renderCard = (preset: import('../theme').ThemePreset) => {
                  const isActive = activePreset === preset.id || (activePreset === 'red' && preset.id === 'visualdesign') || (activePreset === 'blue' && preset.id === 'visualpro');
                  const salvo = s.themeOver[preset.id];
                  const currentRailBg = salvo?.railBg || preset.railBg;
                  const corIcones = salvo?.railInk || preset.railInk;
                  const corLinks = salvo?.primary || preset.primary;
                  const corBotoes = salvo?.danger || (preset.id === 'visualdesign' || preset.id === 'black_red' || preset.id === 'gray_red' || preset.id === 'white_red' ? '#E5202E' : preset.primary);
                  const isEditingThis = editingPresetId === preset.id;

                  return (
                    <div
                      key={preset.id}
                      onClick={() => {
                        if (!isActive) setColorPreset(preset.id);
                      }}
                      style={{
                        background: 'var(--card)',
                        border: `2px solid ${isActive ? preset.primary : 'var(--line)'}`,
                        borderRadius: 'calc(var(--r) + 2px)',
                        padding: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        boxShadow: isActive ? `0 4px 16px ${preset.primary}25` : 'none',
                      }}
                    >
                      {isActive && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            background: preset.primary,
                            color: '#fff',
                            borderRadius: '50%',
                            width: 22,
                            height: 22,
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 11,
                          }}
                        >
                          <i className="fa-solid fa-check" />
                        </span>
                      )}

                      {/* Badge da Cor */}
                      {preset.brandBadge && (
                        <div style={{ marginBottom: 8 }}>
                          <span
                            style={{
                              background: preset.primary,
                              color: '#fff',
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: 4,
                              letterSpacing: '0.6px',
                            }}
                          >
                            {preset.brandBadge}
                          </span>
                        </div>
                      )}

                      {/* Swatch de 4 Quadrados com Correspondência Exata */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                        {/* 1. Background (Fundo da Barra Compacta) */}
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: currentRailBg,
                            border: '1px solid var(--line)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 12,
                            color: corIcones,
                          }}
                          title="1º Fundo: Background da Barra Compacta"
                        >
                          <i className="fa-solid fa-layer-group" />
                        </div>

                        {/* 2. Ícones (Cor dos Ícones da Barra) */}
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: corIcones,
                            border: '1px solid var(--line)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 12,
                            color: currentRailBg,
                          }}
                          title="2º Ícones: Ícones da Barra Compacta"
                        >
                          <i className="fa-solid fa-icons" />
                        </div>

                        {/* 3. Links (Links & Destaques) */}
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: corLinks,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 12,
                            color: '#fff',
                          }}
                          title="3º Links: Links & Destaques do Painel"
                        >
                          <i className="fa-solid fa-link" />
                        </div>

                        {/* 4. Botões (Botões & Bolinhas de Mensagens) */}
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: corBotoes,
                            border: '1px solid var(--line)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 12,
                            color: '#fff',
                          }}
                          title="4º Botões: Botões & Bolinhas de Mensagens"
                        >
                          <i className="fa-solid fa-circle-dot" />
                        </div>
                      </div>

                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: 'var(--ink)' }}>
                        {preset.name}
                        {salvo && <span className="frm-tag" style={{ marginLeft: 6 }}>{t('alterado')}</span>}
                      </div>
                      {preset.tagline && (
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: preset.primary, fontStyle: 'italic', marginBottom: 6 }}>
                          “{preset.tagline}”
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4, marginBottom: 12 }}>
                        {preset.description}
                      </div>

                      {/* Mini Demonstração do Painel */}
                      <div
                        style={{
                          background: s.theme === 'dark' ? '#1c1e26' : '#f4f4f6',
                          border: '1px solid var(--line)',
                          borderRadius: 6,
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'stretch',
                          height: 40,
                          marginBottom: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 22,
                            background: currentRailBg,
                            borderRadius: '4px 0 0 4px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 3,
                            borderRight: '1px solid var(--line)',
                            position: 'relative',
                          }}
                        >
                          {/* Ícone no Mini Preview (Square 2) */}
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: corIcones }} />
                          <div style={{ width: 10, height: 2, background: preset.railOn }} />
                          {/* Bolinha de Notificação/Mensagens (Square 4) */}
                          <div
                            style={{
                              position: 'absolute',
                              top: 2,
                              right: 2,
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              background: corBotoes,
                            }}
                            title="Bolinha de Mensagens"
                          />
                        </div>

                        <div style={{ flex: 1, padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          {/* Link (Square 3) */}
                          <span style={{ fontSize: 11, fontWeight: 700, color: corLinks }}>Link / Destaque</span>
                          {/* Botão (Square 4) */}
                          <button
                            style={{
                              border: 'none',
                              background: corBotoes,
                              color: '#fff',
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 3,
                            }}
                          >
                            OK
                          </button>
                        </div>
                      </div>

                      {/* Botão Editar Grupo / Editar V-Host Colors */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button
                          className="btn sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isActive) setColorPreset(preset.id);
                            setEditingPresetId(isEditingThis ? null : preset.id);
                          }}
                          style={{
                            background: isEditingThis ? 'var(--red)' : 'var(--soft)',
                            color: isEditingThis ? '#fff' : 'var(--ink)',
                            border: '1px solid var(--line)',
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '0 12px',
                            height: 30,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <i className="fa-solid fa-sliders" />
                          {isEditingThis ? t('Fechar Editor') : t('Editar Grupo')}
                        </button>
                      </div>

                      {/* Painel Expansível de Edição V-Host Colors */}
                      {isEditingThis && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            marginTop: 12,
                            padding: 14,
                            background: 'var(--soft)',
                            border: '1px solid var(--line)',
                            borderRadius: 'var(--r)',
                          }}
                        >
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <i className="fa-solid fa-palette" style={{ color: 'var(--red)' }} />
                            {t('Editar V-Host Colors do Grupo')}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 12 }}>
                            {/* 1. Background */}
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: 'var(--muted)' }}>
                                1º Fundo (Rail)
                              </label>
                              <input
                                type="color"
                                value={compColors.railBg}
                                onChange={(e) => handleCompColorChange('railBg', e.target.value)}
                                style={{ width: '100%', height: 32, border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                              />
                            </div>

                            {/* 2. Ícones */}
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: 'var(--muted)' }}>
                                2º Ícones
                              </label>
                              <input
                                type="color"
                                value={compColors.railInk}
                                onChange={(e) => handleCompColorChange('railInk', e.target.value)}
                                style={{ width: '100%', height: 32, border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                              />
                            </div>

                            {/* 3. Links & Destaques */}
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: 'var(--muted)' }}>
                                3º Links (Primary)
                              </label>
                              <input
                                type="color"
                                value={compColors.primary}
                                onChange={(e) => handleCompColorChange('primary', e.target.value)}
                                style={{ width: '100%', height: 32, border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                              />
                            </div>

                            {/* 4. Botões & Notificações */}
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: 'var(--muted)' }}>
                                4º Botões/Badges
                              </label>
                              <input
                                type="color"
                                value={compColors.danger}
                                onChange={(e) => handleCompColorChange('danger', e.target.value)}
                                style={{ width: '100%', height: 32, border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                              className="btn sm"
                              style={{ background: '#EA580C', color: '#fff', border: 'none', height: 28, padding: '0 10px', fontWeight: 700, fontSize: 11 }}
                              onClick={handleUndoCompColors}
                            >
                              <i className="fa-solid fa-rotate-left" />
                              {t('Restaurar')}
                            </button>
                            <button
                              className="btn sm"
                              style={{ background: '#16A34A', color: '#fff', border: 'none', height: 28, padding: '0 12px', fontWeight: 700, fontSize: 11 }}
                              onClick={() => {
                                handleSaveCompColors();
                                setEditingPresetId(null);
                              }}
                            >
                              <i className="fa-solid fa-floppy-disk" />
                              {t('Guardar')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <div>
                    {/* LINHA 1 */}
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--muted)', marginBottom: 10 }}>
                        {t('Linha 1 — Vermelho, Preto & Vermelho, Cinza & Vermelho, Branco & Vermelho')}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                        {row1Presets.map(renderCard)}
                      </div>
                    </div>

                    {/* LINHA 2 */}
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--muted)', marginBottom: 10 }}>
                        {t('Linha 2 — Eventos, Web, Transporte e Pro')}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                        {row2Presets.map(renderCard)}
                      </div>
                    </div>

                    {/* LINHA 3 */}
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--muted)', marginBottom: 10 }}>
                        {t('Linha 3 — Puro Black, Obsidian Black, Cinza Suave e Branco Puro')}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                        {row3Presets.map(renderCard)}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Sub-secção: Hex Personalizado */}
          {(sub1 === 'all' || sub1 === 'custom_hex') && (
            <div
              style={{
                background: 'var(--card)',
                border: `2px solid ${isCustom ? currentColors.primary : 'var(--line)'}`,
                borderRadius: 'var(--r)',
                padding: '20px',
                marginBottom: '24px',
              }}
            >
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-eye-dropper" style={{ color: currentColors.primary }} />
                {t('Cor Personalizada da Marca (#HEX)')}
              </h4>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
                {t('Insira o código hexadecimal (#HEX) para aplicar a cor exata da sua empresa a todo o painel.')}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 400 }}>
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => handleCustomSubmit(e.target.value)}
                  style={{
                    width: 44,
                    height: 38,
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r)',
                    cursor: 'pointer',
                    padding: 2,
                    background: 'transparent',
                  }}
                />
                <input
                  type="text"
                  value={customHex}
                  onChange={(e) => handleCustomSubmit(e.target.value)}
                  placeholder="#E5202E"
                  style={{
                    flex: 1,
                    height: 38,
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r)',
                    padding: '0 12px',
                    fontSize: 14,
                    fontWeight: 600,
                    background: 'var(--soft)',
                    color: 'var(--ink)',
                  }}
                />
                <button
                  className="btn r sm"
                  style={{ height: 38, padding: '0 16px' }}
                  onClick={() => setColorPreset('custom', customHex)}
                >
                  {t('Aplicar')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* NÍVEL 2: CATEGORIA LAYOUT & CANTOS ARREDONDADOS */}
      {sub0 === 'layout' && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r)',
            padding: '22px 24px',
            marginBottom: '24px',
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-shapes" style={{ color: 'var(--red)' }} />
            {t('Estilo dos Cantos (Border Radius - Padrão 4px)')}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            {t('Por defeito o sistema utiliza 4px. Escolha a intensidade das curvas dos botões, cartões e painéis.')}
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', maxWidth: 500 }}>
            {[
              ['4px', 'Padrão (4px)', 'Curvas discretas padronizadas'],
              ['8px', 'Suave (8px)', 'Curvas modernas e equilibradas'],
              ['12px', 'Redondo (12px)', 'Estilo orgânico e arredondado'],
            ].map(([rVal, label, sub]) => (
              <div
                key={rVal}
                onClick={() => setRadius(rVal)}
                style={{
                  flex: 1,
                  minWidth: 140,
                  background: activeRadius === rVal ? 'var(--tint)' : 'var(--soft)',
                  border: `2px solid ${activeRadius === rVal ? 'var(--red)' : 'var(--line)'}`,
                  borderRadius: rVal,
                  padding: 14,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14, color: activeRadius === rVal ? 'var(--red)' : 'var(--ink)', marginBottom: 4 }}>
                  {label}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NÍVEL 2: CATEGORIA MODO DE EXIBIÇÃO (Light / Dark) */}
      {sub0 === 'aparencia' && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r)',
            padding: '22px 24px',
            marginBottom: '24px',
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-circle-half-stroke" style={{ color: 'var(--red)' }} />
            {t('Modo de Exibição do Painel')}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            {t('Alterne instantaneamente entre os modos de luz conforme a sua preferência de leitura.')}
          </p>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', maxWidth: 500 }}>
            <button
              className={'btn ' + (s.theme === 'light' ? 'r' : '')}
              style={{ flex: 1, height: 46, justifyContent: 'center', fontSize: 14, gap: 8 }}
              onClick={() => {
                if (s.theme !== 'light') toggleTheme();
              }}
            >
              <i className="fa-solid fa-sun" style={{ fontSize: 18 }} />
              {t('Modo Claro (Light Mode)')}
            </button>
            <button
              className={'btn ' + (s.theme === 'dark' ? 'r' : '')}
              style={{ flex: 1, height: 46, justifyContent: 'center', fontSize: 14, gap: 8 }}
              onClick={() => {
                if (s.theme !== 'dark') toggleTheme();
              }}
            >
              <i className="fa-solid fa-moon" style={{ fontSize: 18 }} />
              {t('Modo Escuro (Dark Mode)')}
            </button>
          </div>
        </div>
      )}

      {/* NÍVEL 2: CATEGORIA MARCA & LOGÓTIPO */}
      {sub0 === 'marca' && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r)',
            padding: '22px 24px',
            marginBottom: '24px',
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-font" style={{ color: 'var(--red)' }} />
            {t('Personalização da Marca & Logótipo')}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            {t('Defina o nome da sua empresa para ser exibido nos títulos e relatórios do painel.')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 500 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                {t('Nome do Painel / Empresa')}
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                style={{
                  width: '100%',
                  height: 38,
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r)',
                  padding: '0 12px',
                  fontSize: 14,
                  fontWeight: 600,
                  background: 'var(--soft)',
                  color: 'var(--ink)',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                {t('URL do Logótipo Personalizado (Opcional)')}
              </label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://suaempresa.com/logo.png"
                style={{
                  width: '100%',
                  height: 38,
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r)',
                  padding: '0 12px',
                  fontSize: 13,
                  background: 'var(--soft)',
                  color: 'var(--ink)',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl || LOGO} alt="" style={{ width: 42, height: 42, objectFit: 'contain', border: '1px solid var(--line)', borderRadius: 'var(--r)', background: 'var(--soft)' }} />
              <button className="btn g sm" style={{ height: 38 }} onClick={() => fileRef.current?.click()}>
                <i className="fa-solid fa-upload" />
                {t('Carregar imagem')}
              </button>
              {logoUrl && (
                <button className="btn g sm" style={{ height: 38 }} onClick={() => setLogoUrl('')}>
                  {t('Tirar')}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={(e) => carregarLogo(e.target.files?.[0])} />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn r sm"
                style={{ height: 38, padding: '0 18px' }}
                onClick={() => setBrand({ name: brandName.trim() === 'VisualHost' ? '' : brandName.trim(), logo: logoUrl.trim() })}
              >
                {t('Guardar Marca')}
              </button>
              {(s.brand.name || s.brand.logo) && (
                <button
                  className="btn g sm"
                  style={{ height: 38, padding: '0 18px' }}
                  onClick={() => {
                    setBrandName('VisualHost');
                    setLogoUrl('');
                    setBrand({ name: '', logo: '' });
                  }}
                >
                  {t('Repor VisualHost')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Demonstração em Tempo Real dos Componentes Herdados */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r)',
          padding: '22px 24px',
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-desktop" style={{ color: 'var(--red)' }} />
          {t('Pré-visualização ao Vivo dos Componentes Herdados')}
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {/* Item 1: Barra Compacta Herdada */}
          <div style={{ background: 'var(--soft)', padding: 14, borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              {t('Fundo 100% Barra Lateral')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--r)',
                  background: 'var(--rail-bg)',
                  border: '1px solid var(--line)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <i className="fa-solid fa-house" style={{ color: 'var(--rail-ink)' }} />
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, display: 'block' }}>Barra Compacta</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>100% sólida e opaca</span>
              </div>
            </div>
          </div>

          {/* Item 2: Botões */}
          <div style={{ background: 'var(--soft)', padding: 14, borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              {t('Botões de Ação')}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn r sm">
                <i className="fa-solid fa-check" />
                Primário
              </button>
              <button className="btn sm">Secundário</button>
            </div>
          </div>

          {/* Item 3: Separador / Tab */}
          <div style={{ background: 'var(--soft)', padding: 14, borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              {t('Navegação e Tabs')}
            </div>
            <div className="lvl" style={{ height: 32, background: 'var(--card)', borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
              <button className="on" style={{ height: 30, fontSize: 12 }}>Ativo</button>
              <button style={{ height: 30, fontSize: 12 }}>Normal</button>
            </div>
          </div>

          {/* Item 4: Submenu Ativo */}
          <div style={{ background: 'var(--soft)', padding: 14, borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              {t('Submenu Ativo')}
            </div>
            <div className="side" style={{ padding: 0 }}>
              <a className="on" style={{ margin: 0, padding: '6px 10px', fontSize: 13 }}>
                <i className="fa-solid fa-star ic" />
                Página Ativa
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
