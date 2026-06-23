'use client';

import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { php } from '@codemirror/lang-php';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { yaml } from '@codemirror/lang-yaml';
import { nginx } from '@codemirror/legacy-modes/mode/nginx';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { githubLight } from '@uiw/codemirror-theme-github';
import { cn } from '@/lib/utils';

function languageExtension(fileName: string) {
  const base = fileName.toLowerCase();
  if (base === '.htaccess') return [StreamLanguage.define(nginx)];
  const ext = base.includes('.') ? base.split('.').pop() || '' : '';
  switch (ext) {
    case 'php':
      return [php()];
    case 'js':
      return [javascript()];
    case 'jsx':
      return [javascript({ jsx: true })];
    case 'ts':
      return [javascript({ typescript: true })];
    case 'tsx':
      return [javascript({ typescript: true, jsx: true })];
    case 'html':
    case 'htm':
    case 'twig':
    case 'vue':
      return [html()];
    case 'css':
    case 'svg':
      return [css()];
    case 'json':
      return [json()];
    case 'xml':
      return [xml()];
    case 'md':
      return [markdown()];
    case 'sql':
      return [sql()];
    case 'yaml':
    case 'yml':
      return [yaml()];
    case 'sh':
    case 'bash':
      return [StreamLanguage.define(shell)];
    case 'ini':
    case 'conf':
    case 'env':
      return [StreamLanguage.define(properties)];
    case 'log':
    case 'txt':
      return [StreamLanguage.define(nginx)];
    default:
      return [javascript()];
  }
}

export function FileManagerCodeEditor({
  fileName,
  value,
  onChange,
  fillHeight = false,
}: {
  fileName: string;
  value: string;
  onChange: (value: string) => void;
  fillHeight?: boolean;
}) {
  const extensions = useMemo(() => languageExtension(fileName), [fileName]);

  return (
    <CodeMirror
      value={value}
      height={fillHeight ? '100%' : '65vh'}
      theme={githubLight}
      extensions={extensions}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightActiveLine: true,
        foldGutter: true,
        bracketMatching: true,
        indentOnInput: true,
        autocompletion: true,
      }}
      className={cn(
        'overflow-hidden rounded border border-gray-300 text-sm dark:border-zinc-600 [&_.cm-focused]:outline-none [&_.cm-scroller]:font-mono',
        fillHeight
          ? 'h-full min-h-0 [&_.cm-editor]:h-full [&_.cm-scroller]:min-h-full'
          : '[&_.cm-editor]:min-h-[65vh]',
      )}
    />
  );
}
