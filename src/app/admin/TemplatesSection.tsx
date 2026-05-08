'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Palette,
  MessageSquare,
  Save,
  Undo2,
  Redo2,
  Variable,
  Mail,
  Eye,
  Code,
  Type,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  Link,
  Image,
  RotateCcw,
  Table2,
  Type as TypeIcon,
  Plus,
  Trash2,
  Paintbrush,
  Droplet
} from 'lucide-react'
import { 
  defaultRenewalTemplates, 
  RenewalTemplate, 
  processTemplate, 
  TemplateVariables,
  loadTemplatesFromServer,
  saveTemplatesToServer,
  resetTemplatesOnServer
} from '@/lib/renewal-templates'

const STORAGE_KEY = 'visualdesign_custom_templates'

export function TemplatesSection() {
  const [templates, setTemplates] = useState<RenewalTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<RenewalTemplate | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<RenewalTemplate | null>(null)
  const [previewVariables, setPreviewVariables] = useState<TemplateVariables>({
    clientName: 'Silva Chamo',
    serviceName: 'meusite.com',
    expirationDate: '15/06/2025',
    daysRemaining: 60,
    renewalPrice: '2,500.00 MT',
    renewalLink: 'https://visualdesignmoz.com/renovar',
    companyName: 'VisualDesign',
    supportEmail: 'suporte@visualdesignmoz.com',
    supportPhone: '+258 85 242 5525'
  })
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [fontSizeDropdownOpen, setFontSizeDropdownOpen] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const cursorPositionRef = useRef<number | null>(null)

  // Salvar estado no histórico
  const saveToHistory = (content: string) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(content)
    if (newHistory.length > 50) newHistory.shift() // Limitar a 50 estados
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  // Undo
  const handleUndo = () => {
    if (historyIndex > 0 && editingTemplate) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      const newContent = history[newIndex]
      setEditingTemplate({ ...editingTemplate, emailBody: newContent })
      // Atualizar diretamente o editor visual
      if (editorRef.current && editorMode === 'visual') {
        editorRef.current.innerHTML = newContent
      }
    }
  }

  // Redo
  const handleRedo = () => {
    if (historyIndex < history.length - 1 && editingTemplate) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      const newContent = history[newIndex]
      setEditingTemplate({ ...editingTemplate, emailBody: newContent })
      // Atualizar diretamente o editor visual
      if (editorRef.current && editorMode === 'visual') {
        editorRef.current.innerHTML = newContent
      }
    }
  }

  // Funções do editor WYSIWYG
  const insertTag = (tag: string, attrs?: string) => {
    if (!editorRef.current || !editingTemplate) return
    const selection = window.getSelection()
    const selectedText = selection?.toString() || ''
    const attrsStr = attrs ? ` ${attrs}` : ''
    const html = `<${tag}${attrsStr}>${selectedText || `Texto ${tag}`}</${tag}>`
    document.execCommand('insertHTML', false, html)
    const newContent = editorRef.current.innerHTML
    setEditingTemplate({ ...editingTemplate, emailBody: newContent })
    saveToHistory(newContent)
  }

  const insertLink = () => {
    if (!editorRef.current || !editingTemplate) return
    const url = prompt('URL do link:', 'https://')
    if (url) {
      const selection = window.getSelection()
      const selectedText = selection?.toString() || 'Clique aqui'
      document.execCommand('insertHTML', false, `<a href="${url}" style="color:#dc2626;text-decoration:underline;">${selectedText}</a>`)
      const newContent = editorRef.current.innerHTML
      setEditingTemplate({ ...editingTemplate, emailBody: newContent })
      saveToHistory(newContent)
    }
  }

  const insertTable = () => {
    if (!editorRef.current || !editingTemplate) return
    const cols = parseInt(prompt('Número de colunas:', '3') || '3')
    const rows = parseInt(prompt('Número de linhas:', '2') || '2')
    if (cols && rows) {
      let tableHTML = '<table style="width:100%;border-collapse:collapse;margin:15px 0;border:1px solid #e5e7eb;">'
      for (let i = 0; i < rows; i++) {
        tableHTML += '<tr>'
        for (let j = 0; j < cols; j++) {
          tableHTML += '<td style="border:1px solid #e5e7eb;padding:10px;min-width:100px;">Célula</td>'
        }
        tableHTML += '</tr>'
      }
      tableHTML += '</table>'
      document.execCommand('insertHTML', false, tableHTML)
      const newContent = editorRef.current.innerHTML
      setEditingTemplate({ ...editingTemplate, emailBody: newContent })
      saveToHistory(newContent)
    }
  }

  const insertEditableButton = () => {
    if (!editorRef.current || !editingTemplate) return
    // Criar um botão CTA com span contentEditable dentro para permitir edição do texto
    const buttonHTML = `
      <a href="{{renewalLink}}" style="display:inline-block;background:#dc2626;color:white;padding:12px 30px;text-decoration:none;border-radius:5px;font-weight:bold;cursor:pointer;">
        <span contenteditable="true" style="outline:none;">CLIQUE AQUI</span>
      </a>
    `
    document.execCommand('insertHTML', false, buttonHTML)
    const newContent = editorRef.current.innerHTML
    setEditingTemplate({ ...editingTemplate, emailBody: newContent })
    saveToHistory(newContent)
  }

  const insertEditableTable = () => {
    if (!editorRef.current || !editingTemplate) return
    
    // Pedir configuração da tabela (padrão: 3 colunas x 2 linhas)
    const cols = parseInt(prompt('Número de colunas:', '3') || '3')
    const rows = parseInt(prompt('Número de linhas:', '2') || '2')
    
    if (cols && rows) {
      // Construir HTML da tabela com controles de hover
      let tableContent = ''
      for (let i = 0; i < rows; i++) {
        tableContent += '<tr>'
        for (let j = 0; j < cols; j++) {
          tableContent += `<td contenteditable="true" style="border:1px solid #d1d5db;padding:12px;min-width:80px;outline:none;text-align:left;vertical-align:top;">Célula ${i + 1}-${j + 1}</td>`
        }
        tableContent += '</tr>'
      }
      
      const tableHTML = `
        <div class="vd-table-wrapper" style="position:relative;display:block;margin:20px 0;padding:0;width:100%;" onmouseover="this.classList.add('vd-table-active')" onmouseout="this.classList.remove('vd-table-active')">
          <table style="border-collapse:collapse;border:1px solid #d1d5db;background:white;width:100%;margin:0;padding:0;">
            ${tableContent}
          </table>
          <div class="vd-table-controls" style="position:absolute;right:-30px;top:0;display:none;flex-direction:column;gap:4px;z-index:100;">
            <button onclick="vdAddColumn(this)" style="width:24px;height:24px;border:none;background:#6b7280;color:white;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-family:Arial;" title="Adicionar coluna">+</button>
            <button onclick="vdDeleteColumn(this)" style="width:24px;height:24px;border:none;background:#ef4444;color:white;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-family:Arial;" title="Eliminar coluna">−</button>
          </div>
          <div class="vd-table-row-controls" style="position:absolute;left:50%;bottom:-30px;transform:translateX(-50%);display:none;gap:4px;z-index:100;">
            <button onclick="vdAddRow(this)" style="width:24px;height:24px;border:none;background:#6b7280;color:white;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-family:Arial;" title="Adicionar linha">+</button>
            <button onclick="vdDeleteRow(this)" style="width:24px;height:24px;border:none;background:#ef4444;color:white;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-family:Arial;" title="Eliminar linha">−</button>
          </div>
          <div class="vd-table-delete" style="position:absolute;right:-30px;bottom:0;display:none;z-index:100;">
            <button onclick="vdDeleteTable(this)" style="width:24px;height:24px;border:none;background:#dc2626;color:white;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;font-family:Arial;" title="Eliminar tabela">✕</button>
          </div>
        </div>
        <style>
          .vd-table-wrapper.vd-table-active .vd-table-controls,
          .vd-table-wrapper.vd-table-active .vd-table-row-controls,
          .vd-table-wrapper.vd-table-active .vd-table-delete { display: flex !important; }
          .vd-table-wrapper table { margin: 0; padding: 0; border-spacing: 0; }
          .vd-table-wrapper td { border: 1px solid #d1d5db; padding: 12px; min-width: 80px; outline: none; text-align: left; background: white; vertical-align: top; }
          .vd-table-wrapper td:hover { background: #f9fafb; }
          .vd-table-wrapper tr { margin: 0; padding: 0; }
        </style>
        <script>
          function vdAddColumn(btn) {
            const table = btn.closest('.vd-table-wrapper').querySelector('table');
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
              const newCell = document.createElement('td');
              newCell.contentEditable = 'true';
              newCell.style.cssText = 'border:1px solid #d1d5db;padding:12px;min-width:80px;outline:none;text-align:left;vertical-align:top;';
              newCell.textContent = 'Nova';
              row.appendChild(newCell);
            });
          }
          function vdDeleteColumn(btn) {
            const wrapper = btn.closest('.vd-table-wrapper');
            const table = wrapper.querySelector('table');
            const rows = table.querySelectorAll('tr');
            const selectedCell = wrapper.querySelector('td:focus, td:active');
            rows.forEach(row => {
              if (row.cells.length > 1) {
                if (selectedCell && selectedCell.cellIndex >= 0) {
                  row.deleteCell(selectedCell.cellIndex);
                } else {
                  row.deleteCell(row.cells.length - 1);
                }
              }
            });
          }
          function vdAddRow(btn) {
            const table = btn.closest('.vd-table-wrapper').querySelector('table');
            const firstRow = table.querySelector('tr');
            const colCount = firstRow ? firstRow.cells.length : 1;
            const newRow = document.createElement('tr');
            for (let i = 0; i < colCount; i++) {
              const newCell = document.createElement('td');
              newCell.contentEditable = 'true';
              newCell.style.cssText = 'border:1px solid #d1d5db;padding:12px;min-width:80px;outline:none;text-align:left;vertical-align:top;';
              newCell.textContent = 'Nova';
              newRow.appendChild(newCell);
            }
            table.appendChild(newRow);
          }
          function vdDeleteRow(btn) {
            const wrapper = btn.closest('.vd-table-wrapper');
            const table = wrapper.querySelector('table');
            const selectedCell = wrapper.querySelector('td:focus, td:active');
            if (selectedCell && selectedCell.parentElement && table.rows.length > 1) {
              selectedCell.parentElement.remove();
            } else if (table.rows.length > 1) {
              table.deleteRow(table.rows.length - 1);
            }
          }
          function vdDeleteTable(btn) {
            const wrapper = btn.closest('.vd-table-wrapper');
            if (wrapper) wrapper.remove();
          }
        </script>
      `
      document.execCommand('insertHTML', false, tableHTML)
      const newContent = editorRef.current.innerHTML
      setEditingTemplate({ ...editingTemplate, emailBody: newContent })
      saveToHistory(newContent)
    }
  }

  const deleteTable = () => {
    const selection = window.getSelection()
    if (!selection || !editorRef.current || !editingTemplate) return
    const node = selection.anchorNode
    if (!node) return
    const cell = node.parentElement?.closest('td, th')
    if (cell) {
      const table = cell.closest('table')
      if (table) {
        table.remove()
        const newContent = editorRef.current.innerHTML
        setEditingTemplate({ ...editingTemplate, emailBody: newContent })
        saveToHistory(newContent)
      }
    }
  }

  const deleteRow = () => {
    const selection = window.getSelection()
    if (!selection || !editorRef.current || !editingTemplate) return
    const node = selection.anchorNode
    if (!node) return
    const row = node.parentElement?.closest('tr')
    if (row) {
      row.remove()
      const newContent = editorRef.current.innerHTML
      setEditingTemplate({ ...editingTemplate, emailBody: newContent })
      saveToHistory(newContent)
    }
  }

  const deleteColumn = () => {
    const selection = window.getSelection()
    if (!selection || !editorRef.current || !editingTemplate) return
    const node = selection.anchorNode
    if (!node) return
    const cell = node.parentElement?.closest('td, th') as HTMLTableCellElement | null
    if (cell) {
      const parentRow = cell.parentElement as HTMLTableRowElement | null
      const index = parentRow ? Array.from(parentRow.cells).indexOf(cell) : -1
      const table = cell.closest('table')
      if (table && index >= 0) {
        table.querySelectorAll('tr').forEach(row => {
          const tableRow = row as HTMLTableRowElement
          if (tableRow.cells[index]) tableRow.cells[index].remove()
        })
        const newContent = editorRef.current.innerHTML
        setEditingTemplate({ ...editingTemplate, emailBody: newContent })
        saveToHistory(newContent)
      }
    }
  }

  const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]
  const fontSizeDropdownRef = useRef<HTMLDivElement>(null)

  // Paleta de cores VisualDesign
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [currentTextColor, setCurrentTextColor] = useState('#000000')
  const colorPickerRef = useRef<HTMLDivElement>(null)

  const textColors = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef',
    '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#9333ea', '#db2777', '#0891b2'
  ]
  const bgColors = [
    '#fef2f2', '#fff7ed', '#fefce8', '#f0fdf4', '#eff6ff', '#faf5ff', '#fdf2f8', '#ecfeff',
    '#fee2e2', '#ffedd5', '#fef9c3', '#dcfce7', '#dbeafe', '#f3e8ff', '#fce7f3', '#cffafe',
    '#fecaca', '#fed7aa', '#fef08a', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fbcfe8', '#a5f3fc'
  ]

  // Fechar color picker ao clicar fora
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

  const applyTextColor = (color: string) => {
    if (!editorRef.current || !editingTemplate) return
    document.execCommand('foreColor', false, color)
    setCurrentTextColor(color)
    const newContent = editorRef.current.innerHTML
    setEditingTemplate({ ...editingTemplate, emailBody: newContent })
    saveToHistory(newContent)
    setColorPickerOpen(false)
  }

  const applyBgColor = (color: string) => {
    if (!editorRef.current || !editingTemplate) return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    
    const range = selection.getRangeAt(0)
    const selectedContent = range.extractContents()
    const span = document.createElement('span')
    span.style.backgroundColor = color
    span.appendChild(selectedContent)
    range.insertNode(span)
    
    const newContent = editorRef.current.innerHTML
    setEditingTemplate({ ...editingTemplate, emailBody: newContent })
    saveToHistory(newContent)
    setColorPickerOpen(false)
  }

  // Fechar dropdown ao clicar fora
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

  const applyFontSize = (size: number) => {
    if (!editorRef.current || !editingTemplate) return
    document.execCommand('fontSize', false, '7')
    const fontElements = editorRef.current.querySelectorAll('font[size="7"]')
    fontElements.forEach(el => {
      el.removeAttribute('size')
      ;(el as HTMLElement).style.fontSize = `${size}px`
    })
    const newContent = editorRef.current.innerHTML
    setEditingTemplate({ ...editingTemplate, emailBody: newContent })
    saveToHistory(newContent)
    setFontSizeDropdownOpen(false)
  }

  const increaseFontSize = () => {
    if (!editorRef.current || !editingTemplate) return
    document.execCommand('fontSize', false, '5')
    const newContent = editorRef.current.innerHTML
    setEditingTemplate({ ...editingTemplate, emailBody: newContent })
    saveToHistory(newContent)
  }

  const decreaseFontSize = () => {
    if (!editorRef.current || !editingTemplate) return
    document.execCommand('fontSize', false, '2')
    const newContent = editorRef.current.innerHTML
    setEditingTemplate({ ...editingTemplate, emailBody: newContent })
    saveToHistory(newContent)
  }

  // Função para salvar posição do cursor
  const saveCursorPosition = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0 && editorRef.current) {
      const range = selection.getRangeAt(0)
      const preCaretRange = range.cloneRange()
      preCaretRange.selectNodeContents(editorRef.current)
      preCaretRange.setEnd(range.endContainer, range.endOffset)
      cursorPositionRef.current = preCaretRange.toString().length
    }
  }

  // Função para restaurar posição do cursor
  const restoreCursorPosition = () => {
    if (cursorPositionRef.current === null || !editorRef.current) return
    const selection = window.getSelection()
    const range = document.createRange()
    let charCount = 0
    let found = false
    
    const traverseNodes = (node: Node) => {
      if (found) return
      if (node.nodeType === Node.TEXT_NODE) {
        const nodeLength = node.textContent?.length || 0
        if (charCount + nodeLength >= cursorPositionRef.current!) {
          range.setStart(node, cursorPositionRef.current! - charCount)
          range.setEnd(node, cursorPositionRef.current! - charCount)
          found = true
        } else {
          charCount += nodeLength
        }
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          traverseNodes(node.childNodes[i])
          if (found) break
        }
      }
    }
    
    traverseNodes(editorRef.current)
    if (found) {
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }

  // Função para focar o editor
  const focusEditor = () => {
    if (!editorRef.current) return
    editorRef.current.focus()
  }

  // Atalhos de teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Shift+Z ou Ctrl+Y para Redo
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
  }

  // Carregar templates do servidor ao iniciar
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setIsLoading(true)
        const serverTemplates = await loadTemplatesFromServer()
        if (serverTemplates && serverTemplates.length > 0) {
          setTemplates(serverTemplates)
        } else {
          // Fallback para padrão se servidor retornar vazio
          setTemplates(defaultRenewalTemplates)
        }
      } catch (error) {
        console.error('Erro ao carregar templates:', error)
        // Fallback para localStorage em caso de erro
        try {
          const saved = localStorage.getItem(STORAGE_KEY)
          if (saved) {
            const customTemplates = JSON.parse(saved) as RenewalTemplate[]
            const merged = defaultRenewalTemplates.map(defaultT => {
              const custom = customTemplates.find(t => t.id === defaultT.id)
              return custom || defaultT
            })
            setTemplates(merged)
          } else {
            setTemplates(defaultRenewalTemplates)
          }
        } catch (e) {
          console.error('Erro ao carregar do localStorage:', e)
          setTemplates(defaultRenewalTemplates)
        }
      } finally {
        setIsLoading(false)
      }
    }
    loadTemplates()
  }, [])

  // Sincronizar conteúdo do editor quando template mudar
  useEffect(() => {
    if (editorRef.current && editingTemplate) {
      // Só atualiza se o conteúdo for diferente (evita perder cursor durante digitação)
      if (editorRef.current.innerHTML !== editingTemplate.emailBody) {
        editorRef.current.innerHTML = editingTemplate.emailBody
      }
    }
  }, [editingTemplate?.id])

  // Salvar templates no servidor (persistência permanente)
  const [saveError, setSaveError] = useState<string | null>(null)
  
  const persistTemplates = async (newTemplates: RenewalTemplate[]) => {
    try {
      setSaveStatus('saving')
      setSaveError(null)
      const success = await saveTemplatesToServer(newTemplates)
      if (success) {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(null), 2000)
      } else {
        setSaveStatus('error')
        setSaveError('Falha ao salvar no servidor')
      }
    } catch (error: any) {
      console.error('Erro ao salvar templates:', error)
      setSaveStatus('error')
      setSaveError(error.message || 'Erro desconhecido ao salvar')
    }
  }

  // Resetar para padrão no servidor
  const resetToDefault = async () => {
    if (confirm('Tem certeza que deseja restaurar os templates padrão? Todas as customizações serão perdidas permanentemente.')) {
      try {
        setSaveStatus('saving')
        const success = await resetTemplatesOnServer()
        if (success) {
          setTemplates(defaultRenewalTemplates)
          setEditingTemplate(null)
          setSelectedTemplate(null)
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus(null), 2000)
        } else {
          setSaveStatus('error')
          alert('Erro ao resetar templates no servidor')
        }
      } catch (error) {
        console.error('Erro ao resetar templates:', error)
        setSaveStatus('error')
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Palette className="w-5 h-5 text-purple-600" />
            Editor de Templates de Notificação
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Personalize as mensagens de renovação enviadas aos clientes
          </p>
        </div>
        {editingTemplate && (
          <div className="flex gap-2 items-center">
            {saveStatus && (
              <span className={`text-xs font-bold px-3 py-1 rounded ${
                saveStatus === 'saved' ? 'bg-green-100 text-green-700' :
                saveStatus === 'saving' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {saveStatus === 'saved' && '✓ Salvo'}
                {saveStatus === 'saving' && 'Salvando...'}
                {saveStatus === 'error' && 'Erro!'}
              </span>
            )}
            <button
              onClick={async () => {
                const newTemplates = templates.map(t => t.id === editingTemplate!.id ? editingTemplate : t)
                setTemplates(newTemplates)
                await persistTemplates(newTemplates)
                setEditingTemplate(null)
              }}
              disabled={saveStatus === 'saving'}
              className="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded font-bold hover:bg-emerald-100 hover:text-emerald-700 flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saveStatus === 'saving' ? 'Salvando...' : 'Salvar Alterações'}
            </button>
            <button
              onClick={() => setEditingTemplate(null)}
              className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-600 font-bold rounded hover:bg-gray-100 hover:text-gray-700 transition-colors flex items-center gap-2"
            >
              <Undo2 className="w-4 h-4" />
              Cancelar
            </button>
            <button
              onClick={resetToDefault}
              className="px-4 py-2 bg-red-50 border border-red-200 text-red-600 font-bold rounded hover:bg-red-100 hover:text-red-700 transition-colors flex items-center gap-2"
              title="Restaurar templates padrão"
            >
              <RotateCcw className="w-4 h-4" />
              Padrão
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Templates */}
        <div className="lg:col-span-1 space-y-3">
          <h4 className="font-medium text-gray-700 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Templates Disponíveis ({templates.length})
          </h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {templates.map(template => (
              <div
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template)
                  setEditingTemplate({ ...template })
                  setHistory([template.emailBody])
                  setHistoryIndex(0)
                  setEditorMode('visual')
                }}
                className={`p-3 rounded border cursor-pointer transition-colors ${
                  editingTemplate?.id === template.id
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    template.urgency === 'critical' ? 'bg-red-500' :
                    template.urgency === 'high' ? 'bg-orange-500' :
                    template.urgency === 'medium' ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`} />
                  <span className="font-medium text-sm">{template.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span className="px-2 py-0.5 bg-gray-100 rounded">
                    {template.daysBefore === 0 ? 'Confirmação' : `${template.daysBefore} dias`}
                  </span>
                  <span className={`px-2 py-0.5 rounded ${
                    template.type === 'error' ? 'bg-red-100 text-red-700' :
                    template.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                    template.type === 'success' ? 'bg-green-100 text-green-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {template.type}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Variáveis Disponíveis */}
          <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
            <h4 className="font-medium text-blue-900 flex items-center gap-2 mb-3">
              <Variable className="w-4 h-4" />
              Variáveis Disponíveis
            </h4>
            <p className="text-xs text-blue-700 mb-2">
              Use estas variáveis nos templates:
            </p>
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{clientName}}'}</code>
                <span className="text-blue-600">Nome do cliente</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{serviceName}}'}</code>
                <span className="text-blue-600">Domínio/Serviço</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{expirationDate}}'}</code>
                <span className="text-blue-600">Data de vencimento</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{daysRemaining}}'}</code>
                <span className="text-blue-600">Dias restantes</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{renewalPrice}}'}</code>
                <span className="text-blue-600">Preço</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{renewalLink}}'}</code>
                <span className="text-blue-600">Link de renovação</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{companyName}}'}</code>
                <span className="text-blue-600">VisualDesign</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{supportEmail}}'}</code>
                <span className="text-blue-600">Email suporte</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{supportPhone}}'}</code>
                <span className="text-blue-600">Telefone</span>
              </div>
            </div>
          </div>
        </div>

        {/* Editor e Preview */}
        <div className="lg:col-span-2 space-y-6">
          {editingTemplate ? (
            <>
              {/* Editor */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Template
                    </label>
                    <input
                      type="text"
                      value={editingTemplate.name}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dias antes do vencimento
                    </label>
                    <input
                      type="number"
                      value={editingTemplate.daysBefore}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, daysBefore: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo
                    </label>
                    <select
                      value={editingTemplate.type}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    >
                      <option value="info">ℹ️ Informativo</option>
                      <option value="success">✅ Sucesso</option>
                      <option value="warning">⚠️ Aviso</option>
                      <option value="error">❌ Erro/Urgente</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Urgência
                    </label>
                    <select
                      value={editingTemplate.urgency}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, urgency: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    >
                      <option value="low">🟢 Baixa</option>
                      <option value="medium">🟡 Média</option>
                      <option value="high">🟠 Alta</option>
                      <option value="critical">🔴 Crítica</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Título da Notificação (Dashboard)
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.title}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Mensagem Curta (Preview)
                  </label>
                  <textarea
                    value={editingTemplate.message}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, message: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Assunto do Email
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.emailSubject}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, emailSubject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Mail className="w-4 h-4" />
                      Corpo do Email
                    </label>
                    {/* Tabs Visual/HTML */}
                    <div className="flex bg-gray-100 rounded p-0.5">
                      <button
                        onClick={() => setEditorMode('visual')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${
                          editorMode === 'visual'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Type className="w-3.5 h-3.5" />
                        Visual
                      </button>
                      <button
                        onClick={() => setEditorMode('html')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${
                          editorMode === 'html'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Code className="w-3.5 h-3.5" />
                        HTML
                      </button>
                    </div>
                  </div>

                  {/* Toolbar (apenas no modo visual) */}
                  {editorMode === 'visual' && (
                    <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 border-b-0 rounded-t px-2 py-1.5">
                      <button
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        className="p-1.5 hover:bg-white hover:shadow rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Desfazer (Ctrl+Z)"
                      >
                        <Undo2 className="w-4 h-4 text-gray-700" />
                      </button>
                      <button
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        className="p-1.5 hover:bg-white hover:shadow rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Refazer (Ctrl+Y ou Ctrl+Shift+Z)"
                      >
                        <Redo2 className="w-4 h-4 text-gray-700" />
                      </button>
                      <div className="w-px h-5 bg-gray-300 mx-1" />
                      <button
                        onClick={() => document.execCommand('bold', false, undefined)}
                        className="p-1.5 hover:bg-white hover:shadow rounded transition-all"
                        title="Negrito (Ctrl+B)"
                      >
                        <Bold className="w-4 h-4 text-gray-700" />
                      </button>
                      <button
                        onClick={() => document.execCommand('italic', false, undefined)}
                        className="p-1.5 hover:bg-white hover:shadow rounded transition-all"
                        title="Itálico (Ctrl+I)"
                      >
                        <Italic className="w-4 h-4 text-gray-700" />
                      </button>
                      <button
                        onClick={() => document.execCommand('underline', false, undefined)}
                        className="p-1.5 hover:bg-white hover:shadow rounded transition-all"
                        title="Sublinhado (Ctrl+U)"
                      >
                        <Underline className="w-4 h-4 text-gray-700" />
                      </button>
                      <div className="w-px h-5 bg-gray-300 mx-1" />
                      {/* Paleta de Cores VisualDesign */}
                      <div className="relative" ref={colorPickerRef}>
                        <button
                          onClick={() => setColorPickerOpen(!colorPickerOpen)}
                          className="flex items-center gap-1 px-2 py-1.5 hover:bg-white hover:shadow rounded transition-all border border-gray-300 bg-white"
                          title="Paleta de Cores"
                        >
                          <Paintbrush className="w-4 h-4 text-gray-700" />
                          <Droplet className="w-3 h-3" style={{ color: currentTextColor }} />
                        </button>
                        {colorPickerOpen && (
                          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-3 min-w-[220px]">
                            {/* Cores do texto */}
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-gray-700 mb-2">Cor do Texto</p>
                              <div className="grid grid-cols-8 gap-1">
                                {textColors.map(color => (
                                  <button
                                    key={color}
                                    onClick={() => applyTextColor(color)}
                                    className="w-5 h-5 rounded border border-gray-300 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: color }}
                                    title={color}
                                  />
                                ))}
                              </div>
                            </div>
                            {/* Cores de fundo */}
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-2">Cor de Fundo</p>
                              <div className="grid grid-cols-8 gap-1">
                                {bgColors.map(color => (
                                  <button
                                    key={color}
                                    onClick={() => applyBgColor(color)}
                                    className="w-5 h-5 rounded border border-gray-300 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: color }}
                                    title={color}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="w-px h-5 bg-gray-300 mx-1" />
                      <button
                        onClick={() => insertTag('ul')}
                        className="p-1.5 hover:bg-white hover:shadow rounded transition-all"
                        title="Lista"
                      >
                        <List className="w-4 h-4 text-gray-700" />
                      </button>
                      <button
                        onClick={() => insertLink()}
                        className="p-1.5 hover:bg-white hover:shadow rounded transition-all"
                        title="Link (Ctrl+K)"
                      >
                        <Link className="w-4 h-4 text-gray-700" />
                      </button>
                      <button
                        onClick={() => insertEditableTable()}
                        className="p-1.5 hover:bg-white hover:shadow rounded transition-all"
                        title="Inserir Tabela Editável"
                      >
                        <Table2 className="w-4 h-4 text-gray-700" />
                      </button>
                      {/* Dropdown de Tamanho de Fonte estilo Word */}
                      <div ref={fontSizeDropdownRef} className="relative">
                        <button
                          onClick={() => setFontSizeDropdownOpen(!fontSizeDropdownOpen)}
                          className="flex items-center gap-1 px-2 py-1.5 hover:bg-white hover:shadow rounded transition-all border border-gray-300 bg-white"
                          title="Tamanho da Fonte"
                        >
                          <span className="text-xs font-medium text-gray-700 min-w-[20px]">Size</span>
                          <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {fontSizeDropdownOpen && (
                          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-[200px] overflow-y-auto min-w-[60px]">
                            {fontSizes.map(size => (
                              <button
                                key={size}
                                onClick={() => applyFontSize(size)}
                                className="w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 text-left"
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="w-px h-5 bg-gray-300 mx-1" />
                      <button
                        onClick={() => insertEditableButton()}
                        className="px-2 py-1 hover:bg-white hover:shadow rounded transition-all text-xs text-gray-700 font-medium"
                        title="Botão CTA com texto editável"
                      >
                        Botão CTA
                      </button>
                    </div>
                  )}

                  {/* Editor Visual */}
                  {editorMode === 'visual' ? (
                    <div
                      ref={editorRef}
                      contentEditable
                      onFocus={focusEditor}
                      onInput={(e) => {
                        const content = e.currentTarget.innerHTML
                        setEditingTemplate({ ...editingTemplate, emailBody: content })
                        saveToHistory(content)
                      }}
                      onKeyDown={handleKeyDown}
                      className="w-full px-3 py-2 border border-gray-300 rounded-b min-h-[300px] max-h-[400px] overflow-y-auto focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-left"
                      style={{ 
                        minHeight: '300px',
                        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                        fontSize: '14px',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word'
                      }}
                    />
                  ) : (
                    /* Editor HTML */
                    <textarea
                      value={editingTemplate.emailBody}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, emailBody: e.target.value })}
                      rows={15}
                      className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      spellCheck={false}
                    />
                  )}
                </div>
              </div>


              {/* Preview */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-4">
                  <Eye className="w-5 h-5" />
                  Preview ao Vivo
                </h4>
                
                {/* Preview Dashboard */}
                <div className={`p-4 rounded border-l-4 mb-4 ${
                  editingTemplate.type === 'error' ? 'bg-red-50 border-red-400' :
                  editingTemplate.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                  editingTemplate.type === 'success' ? 'bg-green-50 border-green-400' :
                  'bg-blue-50 border-blue-400'
                }`}>
                  <p className="font-medium">
                    {processTemplate(editingTemplate, previewVariables).title}
                  </p>
                  <p className="text-sm mt-1 opacity-80">
                    {processTemplate(editingTemplate, previewVariables).message}
                  </p>
                </div>

                {/* Preview Email */}
                <div className="border border-gray-200 rounded overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-700">
                      Assunto: {processTemplate(editingTemplate, previewVariables).emailSubject}
                    </p>
                  </div>
                  <div 
                    className="p-4 bg-white prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: processTemplate(editingTemplate, previewVariables).emailBody 
                    }}
                  />
                </div>

                {/* Editar Variáveis de Preview - Dados Simulados do Cliente */}
                <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-blue-900 flex items-center gap-2">
                      <Variable className="w-4 h-4" />
                      Dados Simulados do Cliente (Preview)
                    </p>
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      Na notificação real, estes valores vêm do registo do cliente
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">Nome do Cliente</label>
                      <input
                        type="text"
                        value={previewVariables.clientName}
                        onChange={(e) => setPreviewVariables({ ...previewVariables, clientName: e.target.value })}
                        placeholder="Ex: João Silva"
                        className="w-full px-3 py-2 border border-blue-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">Serviço (Domínio/Website)</label>
                      <input
                        type="text"
                        value={previewVariables.serviceName}
                        onChange={(e) => setPreviewVariables({ ...previewVariables, serviceName: e.target.value })}
                        placeholder="Ex: meusite.com"
                        className="w-full px-3 py-2 border border-blue-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">Data de Vencimento</label>
                      <input
                        type="text"
                        value={previewVariables.expirationDate}
                        onChange={(e) => setPreviewVariables({ ...previewVariables, expirationDate: e.target.value })}
                        placeholder="Ex: 31/12/2025"
                        className="w-full px-3 py-2 border border-blue-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">
                        Valor da Renovação <span className="text-red-500">*</span>
                        <span className="text-gray-400 font-normal">(editável)</span>
                      </label>
                      <input
                        type="text"
                        value={previewVariables.renewalPrice}
                        onChange={(e) => setPreviewVariables({ ...previewVariables, renewalPrice: e.target.value })}
                        placeholder="Ex: 15.00 MT"
                        className="w-full px-3 py-2 border border-red-200 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent font-medium"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 mt-3">
                    <strong>Nota:</strong> O valor pode ser editado manualmente para cada renovação. Na notificação real, os dados são automaticamente preenchidos com base no registo do cliente no sistema.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded border-2 border-dashed border-gray-200">
              <Palette className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Selecione um template à esquerda para editar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
