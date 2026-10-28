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
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  Link,
  Image,
  Table2,
  Type as TypeIcon,
  Plus,
  Trash2,
  AlertTriangle,
  AlignVerticalSpaceAround
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
import { useAdminSectionChrome } from '@/components/vhost/comuns/AdminSectionChrome'

const LAST_EDITED_KEY = 'visualdesign_last_edited_template_id'

export function TemplatesSection() {
  // Começa já com os templates padrão (sem esperar pelo servidor) para nunca mostrar
  // o painel vazio — é só texto, não há motivo para um ecrã de carregamento.
  const [templates, setTemplates] = useState<RenewalTemplate[]>(defaultRenewalTemplates)
  const [isLoading, setIsLoading] = useState(false)
  const [loadWarning, setLoadWarning] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<RenewalTemplate | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<RenewalTemplate | null>(null)
  const [previewVariables, setPreviewVariables] = useState<TemplateVariables>({
    clientName: 'Silva Chamo',
    serviceName: 'meusite.com',
    expirationDate: '15/06/2025',
    daysRemaining: 60,
    renewalPrice: '2,500.00 MT',
    renewalLink: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://visualdesignmoz.com'}/renovacao/iniciar/domain/exemplo-id`,
    companyName: 'VisualDesign',
    supportEmail: 'suporte@visualdesignmoz.com',
    supportPhone: '+258 85 242 5525',
    paymentMethod: 'M-Pesa',
    invoiceNumber: 'FR082026/0001',
    invoiceDate: '17/04/2026'
  })
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [fontSizeDropdownOpen, setFontSizeDropdownOpen] = useState(false)
  const [lineHeightDropdownOpen, setLineHeightDropdownOpen] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const cursorPositionRef = useRef<number | null>(null)
  // Snapshot do template tal como estava ao ser aberto — permite saber se o
  // utilizador já mexeu nele antes de o servidor responder (ver reconcileServerTemplates).
  const editingSnapshotRef = useRef<string | null>(null)
  // Sinaliza que o emailBody mudou por reconciliação com o servidor (não por
  // digitação do utilizador) — o efeito de sincronização do editor visual usa
  // isto para saber quando deve reescrever o DOM (ver reconcile e o useEffect abaixo).
  const externalSyncRef = useRef(false)
  const lastSyncedTemplateIdRef = useRef<string | null>(null)

  // Abre um template no editor e lembra-o como o último editado
  const selectTemplate = (template: RenewalTemplate) => {
    setSelectedTemplate(template)
    setEditingTemplate({ ...template })
    editingSnapshotRef.current = JSON.stringify(template)
    setHistory([template.emailBody])
    setHistoryIndex(0)
    setEditorMode('visual')
    try {
      localStorage.setItem(LAST_EDITED_KEY, template.id)
    } catch {
      // localStorage indisponível — sem impacto na edição actual
    }
  }

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
      // Actualizar diretamente o editor visual
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
      // Actualizar diretamente o editor visual
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
      <a href="{{renewalLink}}" class="vd-cta-btn-red" style="display:inline-block;background:#dc2626;color:white;padding:12px 30px;text-decoration:none;border-radius:5px;font-weight:bold;cursor:pointer;">
        <span contenteditable="true" style="outline:none;" onbeforeinput="if((this.textContent||'').length<=1&&event.inputType&&event.inputType.indexOf('delete')===0)event.preventDefault();">CLIQUE AQUI</span>
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
            <button onclick="vdAddColumn(this)" style="width:24px;height:24px;border:none;background:#6b7280;color:white;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-family:"Exo 2",sans-serif;" title="Adicionar coluna">+</button>
            <button onclick="vdDeleteColumn(this)" style="width:24px;height:24px;border:none;background:#ef4444;color:white;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-family:"Exo 2",sans-serif;" title="Eliminar coluna">−</button>
          </div>
          <div class="vd-table-row-controls" style="position:absolute;left:50%;bottom:-30px;transform:translateX(-50%);display:none;gap:4px;z-index:100;">
            <button onclick="vdAddRow(this)" style="width:24px;height:24px;border:none;background:#6b7280;color:white;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-family:"Exo 2",sans-serif;" title="Adicionar linha">+</button>
            <button onclick="vdDeleteRow(this)" style="width:24px;height:24px;border:none;background:#ef4444;color:white;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-family:"Exo 2",sans-serif;" title="Eliminar linha">−</button>
          </div>
          <div class="vd-table-delete" style="position:absolute;right:-30px;bottom:0;display:none;z-index:100;">
            <button onclick="vdDeleteTable(this)" style="width:24px;height:24px;border:none;background:#dc2626;color:white;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;font-family:"Exo 2",sans-serif;" title="Eliminar tabela">✕</button>
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

  const fontSizes = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 23, 24, 26, 28, 36, 48, 72]
  const lineHeights = [1, 1.15, 1.3, 1.5, 1.6, 1.8, 2, 2.5]
  const fontSizeDropdownRef = useRef<HTMLDivElement>(null)
  const lineHeightDropdownRef = useRef<HTMLDivElement>(null)

  // Paleta de cores VisualDesign
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [currentTextColor, setCurrentTextColor] = useState('#000000')
  const [currentFontSize, setCurrentFontSize] = useState(14)
  const colorPickerRef = useRef<HTMLDivElement>(null)

  const textColors = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef',
    '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#9333ea', '#db2777', '#0891b2'
  ]
  const bgColors = [
    '#ffffff', '#fef2f2', '#fff7ed', '#fefce8', '#f0fdf4', '#eff6ff', '#faf5ff', '#fdf2f8', '#ecfeff',
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

  // color === null → "Sem fundo": limpa o fundo já aplicado à selecção em vez
  // de a envolver numa cor nova.
  const applyBgColor = (color: string | null) => {
    if (!editorRef.current || !editingTemplate) return
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

  // Fechar dropdown de altura de linha ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (lineHeightDropdownRef.current && !lineHeightDropdownRef.current.contains(event.target as Node)) {
        setLineHeightDropdownOpen(false)
      }
    }
    if (lineHeightDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [lineHeightDropdownOpen])

  // A altura de linha é uma propriedade de bloco (não há document.execCommand para
  // isto) — aplica-se ao elemento de bloco mais próximo da selecção (parágrafo,
  // div, célula, item de lista...), subindo na árvore a partir do cursor.
  const applyLineHeight = (value: number) => {
    if (!editorRef.current || !editingTemplate) return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    let node: Node | null = selection.getRangeAt(0).commonAncestorContainer
    const isBlock = (el: HTMLElement) => {
      const display = getComputedStyle(el).display
      return display === 'block' || display === 'list-item' || /^(P|DIV|LI|H1|H2|H3|H4|H5|H6|TD|BLOCKQUOTE)$/.test(el.tagName)
    }
    while (node && node !== editorRef.current) {
      if (node.nodeType === 1 && isBlock(node as HTMLElement)) {
        ;(node as HTMLElement).style.lineHeight = String(value)
        break
      }
      node = node.parentNode
    }
    const newContent = editorRef.current.innerHTML
    setEditingTemplate({ ...editingTemplate, emailBody: newContent })
    saveToHistory(newContent)
    setLineHeightDropdownOpen(false)
  }

  // Bloco de destaque de largura total (fundo colorido + texto editável),
  // igual em espírito ao Botão CTA mas ocupando toda a largura do conteúdo.
  const insertEditableBanner = () => {
    if (!editorRef.current || !editingTemplate) return
    const bg = prompt('Cor de fundo do destaque (hex):', '#f3f4f6') || '#f3f4f6'
    const bannerHTML = `
      <div style="display:block;width:100%;box-sizing:border-box;background:${bg};color:#374151;padding:16px 20px;margin:20px 0;">
        <span contenteditable="true" style="outline:none;" onbeforeinput="if((this.textContent||'').length<=1&&event.inputType&&event.inputType.indexOf('delete')===0)event.preventDefault();">Texto do destaque</span>
      </div>
    `
    document.execCommand('insertHTML', false, bannerHTML)
    const newContent = editorRef.current.innerHTML
    setEditingTemplate({ ...editingTemplate, emailBody: newContent })
    saveToHistory(newContent)
  }

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
    setCurrentFontSize(size)
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

  // Impede que um botão/link (ex: "PAGAR AGORA") fique completamente vazio —
  // um <a> sem nenhum carácter dentro é removido pelo próprio motor de edição
  // do browser (mesmo quando se está a substituir a selecção por texto novo
  // numa só operação, não só ao apagar), e o texto novo acaba fora do botão
  // em vez de dentro dele.
  const handleBeforeInput = (e: InputEvent) => {
    const inputType = e.inputType
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return

    if (inputType && inputType.startsWith('delete')) {
      if (selection.isCollapsed) {
        // Apagar um carácter de cada vez: o nó onde está o cursor resolve-se
        // sempre a um nó de texto dentro do <a>, closest() funciona bem aqui.
        const node = selection.anchorNode
        const el = node instanceof Element ? node : node?.parentElement
        const link = el?.closest('a')
        if (link) {
          if ((link.textContent || '').length <= 1) {
            e.preventDefault()
            return
          }
          // Mesmo com o link longe de ficar vazio, apagar exactamente a
          // partir do início (ou do fim, para Delete) do seu texto sai do
          // <a> e continua a apagar o que vem antes/depois — o cursor
          // "foge" do botão e é aí que se começa a escrever a seguir.
          // Bloqueia só nesse limite exacto, não durante o resto do apagar.
          const textNode = node && node.nodeType === Node.TEXT_NODE ? node : null
          const offset = selection.anchorOffset
          const atStart = textNode === link.firstChild && offset === 0
          const atEnd = textNode === link.lastChild && offset === (textNode?.textContent?.length ?? -1)
          const isBackward = inputType.toLowerCase().includes('backward')
          const isForward = inputType.toLowerCase().includes('forward')
          if ((isBackward && atStart) || (isForward && atEnd)) {
            e.preventDefault()
          }
        }
        return
      }
      if (selectionWouldEmptyALink(selection)) {
        e.preventDefault()
      }
      return
    }

    // Escrever mesmo no limite (início/fim) do texto de um botão — o browser
    // trata essa posição como "fora" do link para efeitos de inserção (regra
    // normal para não estender hiperligações sem querer) e o carácter novo
    // aparece ao lado do botão, não dentro dele. Em vez de reescrever a
    // inserção à mão (não fica fiável para a tecla seguinte, ver mais abaixo),
    // estende a selecção em um carácter para dentro do link antes de deixar o
    // browser escrever por cima da forma normal — substitui esse carácter da
    // extremidade, mas mantém tudo dentro do botão de forma fiável.
    if (selection.isCollapsed && (inputType === 'insertText' || inputType === 'insertCompositionText')) {
      const node = selection.anchorNode
      const el = node instanceof Element ? node : node?.parentElement
      const link = el?.closest('a')
      if (link && (link.textContent || '').length > 0) {
        const textNode = node && node.nodeType === Node.TEXT_NODE ? node : null
        const offset = selection.anchorOffset
        const atStart = textNode === link.firstChild && offset === 0
        const atEnd = textNode === link.lastChild && offset === (textNode?.textContent?.length ?? -1)
        if (atStart) {
          selection.modify('extend', 'forward', 'character')
        } else if (atEnd) {
          selection.modify('extend', 'backward', 'character')
        }
      }
    }

    // Escrever por cima de uma selecção que cobre um botão inteiro (ex:
    // seleccionar "PAGAR AGORA" e começar logo a escrever o texto novo, sem
    // apagar primeiro) — o browser trataria isto como "apagar a selecção e
    // inserir", esvaziando o <a> a meio da operação. Em vez de reconstruir a
    // inserção à mão (o motor de edição nativo do browser não reconhece de
    // forma fiável uma selecção recriada por JavaScript para a tecla
    // seguinte), encolhe-se a selecção em um carácter antes de deixar o
    // browser tratar a inserção da forma normal — o <a> nunca fica vazio
    // porque esse último carácter nunca chega a ser apagado. Sobra um
    // carácter antigo no fim do botão, que se remove com um Backspace extra
    // (já seguro nessa altura, o link já não está perto de ficar vazio).
    if ((inputType === 'insertText' || inputType === 'insertReplacementText' || inputType === 'insertFromPaste') && !selection.isCollapsed) {
      const link = selectionWouldEmptyALink(selection)
      const linkTextNode = link?.firstChild
      if (link && linkTextNode && linkTextNode.nodeType === Node.TEXT_NODE && (linkTextNode.textContent?.length ?? 0) > 0) {
        // Independentemente de onde a selecção original terminava (pode ir
        // parar a um parágrafo depois do botão), o novo limite fica sempre
        // amarrado ao próprio nó de texto do link — encolhe sempre para
        // dentro do botão, nunca cresce por engano (ao contrário de
        // Selection.modify(), cuja direcção depende de qual ponta é o focus,
        // imprevisível conforme como a selecção foi feita).
        const range = selection.getRangeAt(0)
        range.setEnd(linkTextNode, (linkTextNode.textContent?.length ?? 1) - 1)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }
  }

  // Se a selecção actual cobre por completo o texto de algum botão/link
  // dentro do editor, devolve esse link (apagá-la/substituí-la esvaziaria o
  // botão) — caso contrário devolve null. Testa por conteúdo em vez de
  // comparar limites exactos da selecção porque posições equivalentes podem
  // ser representadas de formas diferentes consoante a selecção atravessa
  // limites de elementos (frágil de comparar directamente).
  const selectionWouldEmptyALink = (selection: Selection): HTMLAnchorElement | null => {
    if (!editorRef.current || selection.rangeCount === 0) return null
    const range = selection.getRangeAt(0)
    const selectedText = range.toString()
    const links = editorRef.current.querySelectorAll('a')
    for (const link of Array.from(links)) {
      const linkText = link.textContent || ''
      if (linkText.length === 0) continue
      if (range.intersectsNode(link) && selectedText.includes(linkText)) {
        return link
      }
    }
    return null
  }

  // Liga o guard acima directamente ao DOM (addEventListener nativo, não a
  // prop React onBeforeInput) — o evento beforeinput nativo do contentEditable
  // já dispara e é cancelado antes do motor de edição do browser chegar a
  // remover o <a> vazio; a versão via prop React chegava tarde de mais.
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    el.addEventListener('beforeinput', handleBeforeInput, true)
    return () => el.removeEventListener('beforeinput', handleBeforeInput, true)
  }, [editingTemplate?.id, editorMode])

  // Remove qualquer fundo/cor de fundo do HTML colado — texto copiado de fora
  // (ou da própria caixa "Variáveis Disponíveis", que tem fundo azul) não pode
  // trazer esse retângulo colorido agarrado para dentro do corpo do email.
  const stripBackgrounds = (html: string): string => {
    const container = document.createElement('div')
    container.innerHTML = html
    const elements = container.querySelectorAll<HTMLElement>('*')
    elements.forEach((el) => {
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
    if (editorRef.current && editingTemplate) {
      const newContent = editorRef.current.innerHTML
      setEditingTemplate({ ...editingTemplate, emailBody: newContent })
      saveToHistory(newContent)
    }
  }

  // Escolhe qual template abrir por defeito: o último editado (lembrado no
  // localStorage), ou o primeiro da lista se ainda não houver nenhum.
  const pickDefaultTemplate = (list: RenewalTemplate[]): RenewalTemplate => {
    let lastEditedId: string | null = null
    try {
      lastEditedId = localStorage.getItem(LAST_EDITED_KEY)
    } catch {
      // localStorage indisponível — usa o primeiro da lista
    }
    return (lastEditedId && list.find(t => t.id === lastEditedId)) || list[0]
  }

  // Abre imediatamente um template a partir do cache local (ou padrões) assim que o
  // componente monta — nunca mostra o painel vazio e evita o spinner infinito.
  useEffect(() => {
    try {
      const cached = typeof window !== 'undefined' ? localStorage.getItem('visualdesign_custom_templates') : null
      if (cached) {
        const parsed = JSON.parse(cached) as RenewalTemplate[]
        const merged = defaultRenewalTemplates.map(defaultT => parsed.find(t => t.id === defaultT.id) || defaultT)
        setTemplates(merged)
        const initialTemplate = pickDefaultTemplate(merged)
        selectTemplate(initialTemplate)
      } else {
        selectTemplate(pickDefaultTemplate(defaultRenewalTemplates))
      }
    } catch {
      selectTemplate(pickDefaultTemplate(defaultRenewalTemplates))
    }
     
  }, [])

  // Carregar templates do servidor e reconciliar com o que já está aberto
  useEffect(() => {
    // Actualiza a lista (tabs) e, se o template aberto ainda não tiver sido tocado
    // pelo utilizador, actualiza também o próprio editor para a versão do servidor
    // (que pode já ter personalizações gravadas). Se já houver edições em curso,
    // não mexe — evita perder o que a pessoa estava a escrever.
    const reconcile = (list: RenewalTemplate[]) => {
      setTemplates(list)
      setEditingTemplate(current => {
        if (!current) return current
        if (editingSnapshotRef.current !== JSON.stringify(current)) return current
        const fresh = list.find(t => t.id === current.id)
        if (!fresh || JSON.stringify(fresh) === editingSnapshotRef.current) return current
        editingSnapshotRef.current = JSON.stringify(fresh)
        externalSyncRef.current = true
        setHistory([fresh.emailBody])
        setHistoryIndex(0)
        return { ...fresh }
      })
    }

    const loadTemplates = async () => {
      setIsLoading(true)
      const result = await loadTemplatesFromServer()
      if (result.templates.length > 0) {
        reconcile(result.templates)
      }
      setLoadWarning(
        result.source === 'server'
          ? null
          : result.source === 'localStorage'
            ? `Não foi possível ligar ao servidor — a mostrar a última versão guardada apenas neste dispositivo/browser, não a versão oficial. Motivo: ${result.error || 'desconhecido'}`
            : `Não foi possível carregar as personalizações guardadas — a mostrar os valores padrão (não editados). Motivo: ${result.error || 'desconhecido'}`
      )
      setIsLoading(false)
    }
    loadTemplates()
  }, [])

  // Sincronizar conteúdo do editor quando o template mudar (troca de template)
  // ou quando o emailBody for actualizado por reconciliação com o servidor
  // (externalSyncRef) — nunca por causa da própria digitação do utilizador,
  // que já actualiza o DOM directamente antes de chamar setEditingTemplate.
  useEffect(() => {
    if (!editorRef.current || !editingTemplate) return
    const templateChanged = lastSyncedTemplateIdRef.current !== editingTemplate.id
    if (templateChanged || externalSyncRef.current) {
      if (editorRef.current.innerHTML !== editingTemplate.emailBody) {
        editorRef.current.innerHTML = editingTemplate.emailBody
      }
      lastSyncedTemplateIdRef.current = editingTemplate.id
      externalSyncRef.current = false
    }
  }, [editingTemplate])

  const getLatestEditingTemplate = () => {
    if (!editingTemplate) return null

    const latestTemplate = { ...editingTemplate }
    if (editorMode === 'visual' && editorRef.current) {
      latestTemplate.emailBody = editorRef.current.innerHTML
    }

    return latestTemplate
  }

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
        setSaveError('Falha ao guardar no servidor')
      }
    } catch (error: any) {
      console.error('Erro ao guardar modelos:', error)
      setSaveStatus('error')
      setSaveError(error.message || 'Erro desconhecido ao guardar')
    }
  }

  // Resetar para padrão no servidor
  const resetToDefault = async () => {
    if (confirm('Tem a certeza de que deseja restaurar os modelos predefinidos? Todas as personalizações serão perdidas permanentemente.')) {
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

  // Salvar/Cancelar/Eliminar (nomes curtos, pedido do Silva 13/10/2026) ficam na barra de menu principal
  // do dashboard (cabeçalho global), não no cabeçalho local desta secção — ver
  // PanelHeader (chrome.toolbar) e o mesmo padrão em CotacoesSection.tsx.
  const { setChrome } = useAdminSectionChrome()
  useEffect(() => {
    if (!editingTemplate) {
      setChrome(null)
      return
    }
    setChrome({
      toolbar: (
        <>
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
              const latestEditingTemplate = getLatestEditingTemplate()
              if (!latestEditingTemplate) return

              setEditingTemplate(latestEditingTemplate)
              const newTemplates = templates.map(t => t.id === latestEditingTemplate.id ? latestEditingTemplate : t)
              setTemplates(newTemplates)
              await persistTemplates(newTemplates)
              try {
                localStorage.setItem(LAST_EDITED_KEY, latestEditingTemplate.id)
              } catch {
                // localStorage indisponível — sem impacto na gravação já concluída
              }
            }}
            disabled={saveStatus === 'saving'}
            className="h-[38px] px-4 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded font-bold hover:bg-emerald-100 hover:text-emerald-700 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saveStatus === 'saving' ? 'A guardar...' : 'Guardar'}
          </button>
          <button
            onClick={() => setEditingTemplate(null)}
            className="h-[38px] px-4 bg-gray-50 border border-gray-200 text-gray-600 font-bold rounded hover:bg-gray-100 hover:text-gray-700 transition-colors flex items-center gap-2"
          >
            <Undo2 className="w-4 h-4" />
            Cancelar
          </button>
          <button
            onClick={resetToDefault}
            className="h-[38px] px-4 bg-red-50 border border-red-200 text-red-600 font-bold rounded hover:bg-red-100 hover:text-red-700 transition-colors flex items-center gap-2"
            title="Restaurar modelos predefinidos — elimina definitivamente as personalizações guardadas"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar
          </button>
        </>
      )
    })
    return () => setChrome(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTemplate, saveStatus, templates, setChrome])

  return (
    <div className="space-y-6">
      {loadWarning && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span><strong>Aviso:</strong> {loadWarning}</span>
        </div>
      )}
      {/* Header — título/descrição e, na mesma linha, os tabs de tipos de template
          (Salvar/Cancelar/Eliminar Definitivamente passaram para a barra de menu
          principal do dashboard, ver o useEffect de useAdminSectionChrome acima). */}
      <div className="flex flex-wrap items-center justify-start gap-4">
        <div className="flex flex-wrap items-center justify-start gap-2">
          {templates.map(template => (
            <button
              key={template.id}
              onClick={() => selectTemplate(template)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                editingTemplate?.id === template.id
                  ? 'border-purple-500 bg-purple-100 text-purple-700 ring-2 ring-purple-200'
                  : template.type === 'error' ? 'border-red-200 bg-red-50 text-red-700 hover:border-red-300'
                  : template.type === 'warning' ? 'border-yellow-200 bg-yellow-50 text-yellow-700 hover:border-yellow-300'
                  : template.type === 'success' ? 'border-green-200 bg-green-50 text-green-700 hover:border-green-300'
                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                template.urgency === 'critical' ? 'bg-red-500' :
                template.urgency === 'high' ? 'bg-orange-500' :
                template.urgency === 'medium' ? 'bg-yellow-500' :
                'bg-blue-500'
              }`} />
              {template.daysBefore === 0 ? 'Confirmação' : template.daysBefore === 1 ? '1 dia' : `${template.daysBefore} dias`}
            </button>
          ))}
        </div>
      </div>

      {saveStatus === 'error' && saveError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span><strong>Falha ao gravar:</strong> {saveError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-6">

        {/* Editor */}
        <div className="space-y-4">
          {editingTemplate ? (
            <div className="space-y-4 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                        className="w-7 p-1.5 hover:bg-white hover:shadow rounded transition-all flex items-center justify-center"
                        title="Negrito (Ctrl+B)"
                      >
                        <span className="font-bold text-gray-700 text-sm leading-none">B</span>
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
                          className="w-4 h-4 rounded border border-gray-300 hover:scale-110 transition-transform"
                          style={{ backgroundColor: currentTextColor }}
                          title="Paleta de Cores"
                        />
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
                                <button
                                  onClick={() => applyBgColor(null)}
                                  className="w-5 h-5 rounded border border-gray-300 hover:scale-110 transition-transform relative bg-white overflow-hidden"
                                  title="Sem fundo"
                                >
                                  <span
                                    className="absolute inset-0"
                                    style={{ background: 'linear-gradient(to top right, transparent calc(50% - 1px), #dc2626, transparent calc(50% + 1px))' }}
                                  />
                                </button>
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
                          <span className="text-xs font-medium text-gray-700 min-w-[20px]">{currentFontSize}</span>
                          <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {fontSizeDropdownOpen && (
                          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-[240px] overflow-y-auto min-w-[60px]">
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
                      {/* Dropdown de Altura de Linha */}
                      <div ref={lineHeightDropdownRef} className="relative">
                        <button
                          onClick={() => setLineHeightDropdownOpen(!lineHeightDropdownOpen)}
                          className="flex items-center gap-1 px-2 py-1.5 hover:bg-white hover:shadow rounded transition-all border border-gray-300 bg-white"
                          title="Altura da Linha"
                        >
                          <AlignVerticalSpaceAround className="w-4 h-4 text-gray-700" />
                          <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {lineHeightDropdownOpen && (
                          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-[240px] overflow-y-auto min-w-[60px]">
                            {lineHeights.map(value => (
                              <button
                                key={value}
                                onClick={() => applyLineHeight(value)}
                                className="w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 text-left"
                              >
                                {value}
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
                      <button
                        onClick={() => insertEditableBanner()}
                        className="px-2 py-1 hover:bg-white hover:shadow rounded transition-all text-xs text-gray-700 font-medium"
                        title="Bloco de destaque com fundo colorido, largura total"
                      >
                        Bloco Destaque
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
                      onPaste={handlePaste}
                      className="w-full px-3 py-2 border border-gray-300 rounded-b min-h-[150px] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-left"
                      style={{
                        minHeight: '150px',
                        height: 'auto',
                        fontFamily: '"Exo 2", sans-serif',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        wordWrap: 'break-word'
                      }}
                    />
                  ) : (
                    /* Editor HTML */
                    <textarea
                      value={editingTemplate.emailBody}
                      onChange={(e) => {
                        setEditingTemplate({ ...editingTemplate, emailBody: e.target.value })
                        e.target.style.height = 'auto'
                        e.target.style.height = `${e.target.scrollHeight}px`
                      }}
                      ref={(el) => {
                        if (el) {
                          el.style.height = 'auto'
                          el.style.height = `${el.scrollHeight}px`
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-xs min-h-[150px] resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      spellCheck={false}
                    />
                  )}
                </div>

                {/* Variáveis Disponíveis — movida para aqui (ficava perdida no topo
                    da coluna de preview); substitui a antiga caixa de "Dados
                    Simulados do Cliente", que só editava valores de pré-visualização
                    e não os dados reais usados na notificação. */}
                <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
                  <h4 className="font-medium text-blue-900 flex items-center gap-2 mb-3">
                    <Variable className="w-4 h-4" />
                    Variáveis Disponíveis
                  </h4>
                  <p className="text-xs text-blue-700 mb-2">
                    Use estas variáveis nos templates:
                  </p>
                  <div className="grid grid-cols-2 divide-x divide-blue-200 text-xs font-mono">
                    <div className="space-y-1 pr-4">
                      <div className="flex justify-between gap-2">
                        <code className="text-blue-800">{'{{clientName}}'}</code>
                        <span className="text-blue-600">Nome do cliente</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <code className="text-blue-800">{'{{serviceName}}'}</code>
                        <span className="text-blue-600">Domínio/Serviço</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <code className="text-blue-800">{'{{expirationDate}}'}</code>
                        <span className="text-blue-600">Vencimento</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <code className="text-blue-800">{'{{daysRemaining}}'}</code>
                        <span className="text-blue-600">Dias restantes</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <code className="text-blue-800">{'{{renewalPrice}}'}</code>
                        <span className="text-blue-600">Preço</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <code className="text-blue-800">{'{{invoiceNumber}}'}</code>
                        <span className="text-blue-600">Nº da factura</span>
                      </div>
                    </div>
                    <div className="space-y-1 pl-4">
                      <div className="flex justify-between gap-2">
                        <code className="text-blue-800">{'{{renewalLink}}'}</code>
                        <span className="text-blue-600">Link</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <code className="text-blue-800">{'{{companyName}}'}</code>
                        <span className="text-blue-600">VisualDesign</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <code className="text-blue-800">{'{{supportEmail}}'}</code>
                        <span className="text-blue-600">Email suporte</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <code className="text-blue-800">{'{{supportPhone}}'}</code>
                        <span className="text-blue-600">Telefone</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <code className="text-blue-800">{'{{invoiceDate}}'}</code>
                        <span className="text-blue-600">Data da factura</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 mt-3">
                    <strong>Nota:</strong> Na notificação real, todos estes valores vêm do registo do cliente e do ciclo de cobrança — não são editáveis aqui.
                  </p>
                </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded border-2 border-dashed border-gray-200">
              <Palette className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Selecione um template acima para editar</p>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="space-y-4">
          {editingTemplate && (
            <>
              <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-4">
                <Eye className="w-5 h-5" />
                Preview ao Vivo
              </h4>
                
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
