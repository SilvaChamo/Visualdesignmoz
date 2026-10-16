'use client';

/**
 * Editor de blocos do WordPress (Gutenberg) dentro do painel — separador "Páginas" do Gerir WordPress.
 * São os mesmos pacotes do editor do WordPress (@wordpress/block-editor e os blocos do núcleo); o texto da página
 * entra e sai como o WordPress o guarda (HTML com os comentários dos blocos), lido e gravado pelo painel com o WP-CLI.
 * Carregado só quando se abre uma página (é grande).
 */
import { useMemo, useState } from 'react';
import { BlockEditorKeyboardShortcuts, BlockEditorProvider, BlockInspector, BlockList, BlockTools, ObserveTyping, WritingFlow } from '@wordpress/block-editor';
import { parse, rawHandler, serialize } from '@wordpress/blocks';
import { registerCoreBlocks } from '@wordpress/block-library';
import { Popover, SlotFillProvider } from '@wordpress/components';
import { setLocaleData } from '@wordpress/i18n';
import '@wordpress/format-library';
import '@wordpress/components/build-style/style.css';
import '@wordpress/block-editor/build-style/style.css';
import '@wordpress/block-library/build-style/style.css';
import '@wordpress/block-library/build-style/editor.css';
import '@wordpress/block-library/build-style/theme.css';

type BlockInstance = ReturnType<typeof parse>[number];

let registados = false;
/** Traduções primeiro (os nomes dos blocos traduzem-se ao registar), depois os blocos do núcleo — uma só vez */
function registar(traducoes?: Record<string, unknown>) {
  if (registados) return;
  registados = true;
  if (traducoes && Object.keys(traducoes).length > 1) setLocaleData(traducoes as Parameters<typeof setLocaleData>[0]);
  registerCoreBlocks();
}

/** Texto antigo (sem blocos, do editor clássico) passa a blocos, como o "Converter em blocos" do WordPress */
function lerBlocos(html: string): BlockInstance[] {
  if (!html.trim()) return [];
  return html.includes('<!-- wp:') ? parse(html) : rawHandler({ HTML: html });
}

export default function EditorGutenberg({ inicial, traducoes, onChange }: { inicial: string; traducoes?: Record<string, unknown>; onChange: (html: string) => void }) {
  registar(traducoes);
  const primeiro = useMemo(() => lerBlocos(inicial), [inicial]);
  const [blocos, setBlocos] = useState<BlockInstance[]>(primeiro);
  const mudar = (b: BlockInstance[]) => {
    setBlocos(b);
    onChange(serialize(b));
  };
  return (
    <SlotFillProvider>
      <BlockEditorProvider value={blocos} onInput={mudar} onChange={mudar} settings={{ hasFixedToolbar: false, bodyPlaceholder: 'Escreva ou carregue em + para juntar um bloco' }}>
        <div className="gb-editor">
          <div className="gb-conteudo editor-styles-wrapper">
            <BlockEditorKeyboardShortcuts.Register />
            <BlockTools>
              <WritingFlow>
                <ObserveTyping>
                  <BlockList />
                </ObserveTyping>
              </WritingFlow>
            </BlockTools>
          </div>
          <aside className="gb-lateral">
            <BlockInspector />
          </aside>
        </div>
        <Popover.Slot />
      </BlockEditorProvider>
    </SlotFillProvider>
  );
}
