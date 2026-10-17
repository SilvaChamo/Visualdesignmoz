// Carregador do DirectAdmin (as três barras do "WordPress Manager" do DA, a subir e a descer uma a seguir à outra) — o
// que aparece no lugar da tela branca enquanto o painel ainda não tem conteúdo (Silva, 16/10/2026: "quando tenta surgir
// a tela branca coloque o spinner do DA que está na imagem com o mesmo efeito"). Sem estado nem efeitos: serve tanto à
// página do servidor (src/app/host/layout.tsx, enquanto os dados chegam) como ao painel no navegador.
import type { CSSProperties } from 'react';
import { getThemeColors } from './theme';
import type { TemaConta } from '@/lib/vhost-tema-conta';

/** As barras, na cor principal do tema (três tons, como as do DA) */
export function BarrasDa() {
  return (
    <span className="da-barras" role="status" aria-label="A abrir o painel">
      <span />
      <span />
      <span />
    </span>
  );
}

/** Página inteira com as barras ao centro, no fundo e na cor do tema da conta (o do cookie, se o servidor o tiver) */
export function CarregadorDa({ tema }: { tema?: TemaConta | null }) {
  const estilo = tema ? ({ '--red': getThemeColors(tema.colorPreset, tema.customPrimary, tema.themeOver[tema.colorPreset]).primary } as CSSProperties) : undefined;
  return (
    <div className="vh vh-carga" data-theme={tema?.theme || 'light'} style={estilo}>
      <BarrasDa />
    </div>
  );
}
