// Carregador do DirectAdmin (as três barras do "WordPress Manager" do DA, a subir e a descer uma a seguir à outra) — o
// que aparece no lugar da tela branca enquanto o painel ainda não tem conteúdo (Silva, 16/10/2026: "quando tenta surgir
// a tela branca coloque o spinner do DA que está na imagem com o mesmo efeito"). Sem estado nem efeitos: serve tanto à
// página do servidor (src/app/vhost/layout.tsx, enquanto os dados chegam) como ao painel no navegador.
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

/** Roda como a do DA (medida no vídeo do Silva): um arco que cresce e encolhe enquanto gira */
export function Roda({ tamanho, traco, grande }: { tamanho: number; traco: number; grande?: boolean }) {
  const meio = tamanho / 2;
  return (
    <svg className={'ent-roda' + (grande ? ' grande' : '')} width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} aria-hidden>
      <circle cx={meio} cy={meio} r={meio - traco / 2} fill="none" strokeWidth={traco} pathLength={100} />
    </svg>
  );
}

/** Página inteira com as três barras ao centro, no fundo e na cor do tema da conta (o do cookie, se o servidor o tiver). A roda NÃO está aqui:
 *  é só de quem acabou de escrever os dados na entrada do próprio painel (Silva, 27/10/2026) */
export function CarregadorDa({ tema }: { tema?: TemaConta | null }) {
  const estilo = tema ? ({ '--red': getThemeColors(tema.colorPreset, tema.customPrimary, tema.themeOver[tema.colorPreset]).primary } as CSSProperties) : undefined;
  return (
    <div className="vh vh-carga" data-theme={tema?.theme || 'light'} style={estilo} role="status" aria-label="A abrir o painel">
      <BarrasDa />
    </div>
  );
}
