'use client'

import { useEffect, useRef, useState } from 'react'
import { Undo2, Redo2, Italic, Underline, List, Link, Type, Code } from 'lucide-react'

const fontSizes = [10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 36, 48]

const textColors = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#9333ea', '#db2777', '#0891b2'
]
const bgColors = [
  '#ffffff', '#fef2f2', '#fff7ed', '#fefce8', '#f0fdf4', '#eff6ff', '#faf5ff', '#fdf2f8', '#ecfeff',
  '#fee2e2', '#ffedd5', '#fef9c3', '#dcfce7', '#dbeafe', '#f3e8ff', '#fce7f3', '#cffafe'
]

/**
 * Editor de mensagem rico (WYSIWYG) usado no formulário de "Enviar Notificação",
 * com a mesma barra de formatação do editor de Templates de Renovação
 * (TemplatesSection.tsx) — mas independente/genérico, sem os inserts próprios
 * de templates de renovação ({{renewalLink}}, tabelas com controlos globais).
 * Propositadamente duplicado em vez de partilhado com TemplatesSection.tsx
 * para não arriscar regressões nos templates de renovação em produção.
 */
export function NotificationRichEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (html: string) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const fontSizeDropdownRef = useRef<HTMLDivElement>(null)
  const lastSyncedRef = useRef<string>(value)

  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual')
  const [history, setHistory] = useState<string[]>([value])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [fontSizeDropdownOpen, setFontSizeDropdownOpen] = useState(false)
  const [currentTextColor, setCurrentTextColor] = useState('#000000')
  const [currentFontSize, setCurrentFontSize] = useState(14)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setColorPickerOpen(false)
      }
    }
    if (colorPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [colorPickerOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fontSizeDropdownRef.current && !fontSizeDropdownRef.current.contains(event.target as Node)) {
        setFontSizeDropdownOpen(false)
      }
    }
    if (fontSizeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [fontSizeDropdownOpen])

  // Preenche o DOM do editor no primeiro render e sempre que se volta ao modo
  // Visual (o <textarea> do modo HTML é um elemento diferente — React desmonta
  // e remonta a div em cada troca de modo, perdendo o conteúdo imperativo).
  // Evita dangerouslySetInnerHTML directo no JSX, que reescreveria o conteúdo
  // — e a posição do cursor — a cada letra digitada.
  useEffect(() => {
    if (editorMode === 'visual' && editorRef.current) editorRef.current.innerHTML = value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMode])

  // Sincroniza o DOM do editor quando `value` muda por fora (ex.: limpar o
  // formulário depois de enviar) — nunca durante a própria digitação, que já
  // actualiza o DOM directamente antes de chamar onChange.
  useEffect(() => {
    if (value === lastSyncedRef.current) return
    lastSyncedRef.current = value
    if (editorRef.current && editorMode === 'visual' && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value
    }
    setHistory([value])
    setHistoryIndex(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const emit = (html: string) => {
    lastSyncedRef.current = html
    onChange(html)
  }

  const saveToHistory = (content: string) => {
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1)
      next.push(content)
      if (next.length > 50) next.shift()
      setHistoryIndex(next.length - 1)
      return next
    })
  }

  const handleUndo = () => {
    if (historyIndex <= 0) return
    const newIndex = historyIndex - 1
    setHistoryIndex(newIndex)
    const content = history[newIndex]
    if (editorRef.current && editorMode === 'visual') editorRef.current.innerHTML = content
    emit(content)
  }

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return
    const newIndex = historyIndex + 1
    setHistoryIndex(newIndex)
    const content = history[newIndex]
    if (editorRef.current && editorMode === 'visual') editorRef.current.innerHTML = content
    emit(content)
  }

  const afterCommand = () => {
    if (!editorRef.current) return
    const content = editorRef.current.innerHTML
    emit(content)
    saveToHistory(content)
  }

  const insertLink = () => {
    if (!editorRef.current) return
    const url = prompt('URL do link:', 'https://')
    if (!url) return
    const selection = window.getSelection()
    const selectedText = selection?.toString() || 'Clique aqui'
    document.execCommand('insertHTML', false, `<a href="${url}" style="color:#dc2626;text-decoration:underline;">${selectedText}</a>`)
    afterCommand()
  }

  const insertList = () => {
    if (!editorRef.current) return
    const selection = window.getSelection()
    const selectedText = selection?.toString() || 'Item'
    document.execCommand('insertHTML', false, `<ul><li>${selectedText}</li></ul>`)
    afterCommand()
  }

  const applyTextColor = (color: string) => {
    if (!editorRef.current) return
    document.execCommand('foreColor', false, color)
    setCurrentTextColor(color)
    afterCommand()
    setColorPickerOpen(false)
  }

  const applyBgColor = (color: string | null) => {
    if (!editorRef.current) return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    const selectedContent = range.extractContents()
    if (color === null) {
      const wrapper = document.createElement('div')
      wrapper.appendChild(selectedContent)
      wrapper.querySelectorAll<HTMLElement>('*').forEach((el) => {
        el.style.removeProperty('background')
        el.style.removeProperty('background-color')
      })
      const fragment = document.createDocumentFragment()
      while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild)
      range.insertNode(fragment)
    } else {
      const span = document.createElement('span')
      span.style.backgroundColor = color
      span.appendChild(selectedContent)
      range.insertNode(span)
    }
    afterCommand()
    setColorPickerOpen(false)
  }

  const applyFontSize = (size: number) => {
    if (!editorRef.current) return
    document.execCommand('fontSize', false, '7')
    editorRef.current.querySelectorAll('font[size="7"]').forEach((el) => {
      el.removeAttribute('size')
      ;(el as HTMLElement).style.fontSize = `${size}px`
    })
    afterCommand()
    setCurrentFontSize(size)
    setFontSizeDropdownOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return
    if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
      e.preventDefault()
      handleRedo()
      return
    }
    switch (e.key.toLowerCase()) {
      case 'z':
        e.preventDefault()
        handleUndo()
        break
      case 'b':
        e.preventDefault()
        document.execCommand('bold', false, undefined)
        break
      case 'i':
        e.preventDefault()
        document.execCommand('italic', false, undefined)
        break
      case 'u':
        e.preventDefault()
        document.execCommand('underline', false, undefined)
        break
      case 'k':
        e.preventDefault()
        insertLink()
        break
    }
  }

  const stripBackgrounds = (html: string): string => {
    const container = document.createElement('div')
    container.innerHTML = html
    container.querySelectorAll<HTMLElement>('*').forEach((el) => {
      el.style.removeProperty('background')
      el.style.removeProperty('background-color')
      el.style.removeProperty('background-image')
      el.removeAttribute('bgcolor')
    })
    return container.innerHTML
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    const cleanHtml = html
      ? stripBackgrounds(html)
      : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
    document.execCommand('insertHTML', false, cleanHtml)
    afterCommand()
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-1">
        <div className="flex bg-gray-100 rounded p-0.5">
          <button
            type="button"
            onClick={() => setEditorMode('visual')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all ${
              editorMode === 'visual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            Visual
          </button>
          <button
            type="button"
            onClick={() => setEditorMode('html')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all ${
              editorMode === 'html' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            HTML
          </button>
        </div>
      </div>

      {editorMode === 'visual' && (
        <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 border-b-0 rounded-t px-2 py-1.5">
          <button type="button" onClick={handleUndo} disabled={historyIndex <= 0} className="p-1.5 hover:bg-white hover:shadow rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed" title="Desfazer (Ctrl+Z)">
            <Undo2 className="w-4 h-4 text-gray-700" />
          </button>
          <button type="button" onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-1.5 hover:bg-white hover:shadow rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed" title="Refazer (Ctrl+Y)">
            <Redo2 className="w-4 h-4 text-gray-700" />
          </button>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <button type="button" onClick={() => { document.execCommand('bold', false, undefined); afterCommand() }} className="w-7 p-1.5 hover:bg-white hover:shadow rounded transition-all flex items-center justify-center" title="Negrito (Ctrl+B)">
            <span className="font-bold text-gray-700 text-sm leading-none">B</span>
          </button>
          <button type="button" onClick={() => { document.execCommand('italic', false, undefined); afterCommand() }} className="p-1.5 hover:bg-white hover:shadow rounded transition-all" title="Itálico (Ctrl+I)">
            <Italic className="w-4 h-4 text-gray-700" />
          </button>
          <button type="button" onClick={() => { document.execCommand('underline', false, undefined); afterCommand() }} className="p-1.5 hover:bg-white hover:shadow rounded transition-all" title="Sublinhado (Ctrl+U)">
            <Underline className="w-4 h-4 text-gray-700" />
          </button>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <div className="relative" ref={colorPickerRef}>
            <button
              type="button"
              onClick={() => setColorPickerOpen(!colorPickerOpen)}
              className="w-4 h-4 rounded border border-gray-300 hover:scale-110 transition-transform"
              style={{ backgroundColor: currentTextColor }}
              title="Paleta de Cores"
            />
            {colorPickerOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-3 min-w-[220px]">
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Cor do Texto</p>
                  <div className="grid grid-cols-8 gap-1">
                    {textColors.map((color) => (
                      <button key={color} type="button" onClick={() => applyTextColor(color)} className="w-5 h-5 rounded border border-gray-300 hover:scale-110 transition-transform" style={{ backgroundColor: color }} title={color} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Cor de Fundo</p>
                  <div className="grid grid-cols-8 gap-1">
                    <button
                      type="button"
                      onClick={() => applyBgColor(null)}
                      className="w-5 h-5 rounded border border-gray-300 hover:scale-110 transition-transform relative bg-white overflow-hidden"
                      title="Sem fundo"
                    >
                      <span className="absolute inset-0" style={{ background: 'linear-gradient(to top right, transparent calc(50% - 1px), #dc2626, transparent calc(50% + 1px))' }} />
                    </button>
                    {bgColors.map((color) => (
                      <button key={color} type="button" onClick={() => applyBgColor(color)} className="w-5 h-5 rounded border border-gray-300 hover:scale-110 transition-transform" style={{ backgroundColor: color }} title={color} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <button type="button" onClick={insertList} className="p-1.5 hover:bg-white hover:shadow rounded transition-all" title="Lista">
            <List className="w-4 h-4 text-gray-700" />
          </button>
          <button type="button" onClick={insertLink} className="p-1.5 hover:bg-white hover:shadow rounded transition-all" title="Link (Ctrl+K)">
            <Link className="w-4 h-4 text-gray-700" />
          </button>
          <div ref={fontSizeDropdownRef} className="relative ml-auto">
            <button
              type="button"
              onClick={() => setFontSizeDropdownOpen(!fontSizeDropdownOpen)}
              className="flex items-center gap-1 px-2 py-1.5 hover:bg-white hover:shadow rounded transition-all border border-gray-300 bg-white"
              title="Tamanho da Fonte"
            >
              <span className="text-xs font-medium text-gray-700 min-w-[20px]">{currentFontSize}</span>
              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {fontSizeDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-[240px] overflow-y-auto min-w-[60px]">
                {fontSizes.map((size) => (
                  <button key={size} type="button" onClick={() => applyFontSize(size)} className="w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 text-left">
                    {size}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {editorMode === 'visual' ? (
        <div
          ref={editorRef}
          contentEditable
          onInput={(e) => {
            const content = e.currentTarget.innerHTML
            emit(content)
            saveToHistory(content)
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="w-full px-3 py-2 border border-gray-300 rounded-b min-h-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left"
          style={{ minHeight: '150px', fontFamily: '"Exo 2", sans-serif', fontSize: '14px', lineHeight: '1.6', wordWrap: 'break-word' }}
          suppressContentEditableWarning
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => emit(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-xs min-h-[150px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          spellCheck={false}
        />
      )}
    </div>
  )
}
