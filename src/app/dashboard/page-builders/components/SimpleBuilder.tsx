"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  Save, 
  Download, 
  Eye, 
  Code,
  Monitor,
  Smartphone,
  Tablet,
  Type,
  ImageIcon as Image,
  MousePointerClick as Button,
  Box,
  Columns2 as Columns,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Palette,
  Copy,
  Check
} from "lucide-react";

interface SimpleBuilderProps {
  onBack: () => void;
}

interface Element {
  id: string;
  type: string;
  content: string;
  styles: {
    bgColor?: string;
    textColor?: string;
    padding?: string;
    align?: string;
  };
}

const elementTypes = [
  { id: "heading", name: "Título", icon: Type, placeholder: "Digite um título..." },
  { id: "paragraph", name: "Parágrafo", icon: Type, placeholder: "Digite o texto..." },
  { id: "button", name: "Botão", icon: Button, placeholder: "Texto do botão" },
  { id: "image", name: "Imagem", icon: Image, placeholder: "URL da imagem" },
  { id: "container", name: "Container", icon: Box, placeholder: "Seção" },
  { id: "columns", name: "2 Colunas", icon: Columns, placeholder: "Layout em colunas" },
];

export default function SimpleBuilder({ onBack }: SimpleBuilderProps) {
  const [elements, setElements] = useState<Element[]>([
    { id: "1", type: "heading", content: "Bem-vindo!", styles: { align: "center", textColor: "#ffffff" } },
    { id: "2", type: "paragraph", content: "Edite este texto para começar sua página.", styles: { align: "center" } },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [showPreview, setShowPreview] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const addElement = (type: string) => {
    const newElement: Element = {
      id: Date.now().toString(),
      type,
      content: elementTypes.find(e => e.id === type)?.placeholder || "",
      styles: { align: "left" },
    };
    setElements([...elements, newElement]);
  };

  const updateElement = (id: string, updates: Partial<Element>) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const removeElement = (id: string) => {
    setElements(elements.filter(el => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const moveElement = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= elements.length) return;
    const newElements = [...elements];
    [newElements[index], newElements[newIndex]] = [newElements[newIndex], newElements[index]];
    setElements(newElements);
  };

  const generateHTML = () => {
    const elementsHTML = elements.map(el => {
      const style = `text-align: ${el.styles.align || 'left'}; color: ${el.styles.textColor || 'inherit'}; background-color: ${el.styles.bgColor || 'transparent'}; padding: ${el.styles.padding || '16px'};`;
      
      switch (el.type) {
        case "heading":
          return `    <h1 style="${style} margin-bottom: 16px;">${el.content}</h1>`;
        case "paragraph":
          return `    <p style="${style} margin-bottom: 16px; line-height: 1.6;">${el.content}</p>`;
        case "button":
          return `    <div style="text-align: ${el.styles.align || 'left'}; margin-bottom: 16px;">
      <a href="#" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">${el.content}</a>
    </div>`;
        case "image":
          return `    <div style="text-align: ${el.styles.align || 'left'}; margin-bottom: 16px;">
      <img src="${el.content}" alt="" style="max-width: 100%; height: auto; border-radius: 8px;" />
    </div>`;
        case "container":
          return `    <div style="${style} margin-bottom: 16px; border-radius: 8px;">
      <p>${el.content}</p>
    </div>`;
        case "columns":
          return `    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px;">
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px;">Coluna 1</div>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px;">Coluna 2</div>
    </div>`;
        default:
          return "";
      }
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Página Simples</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
  </style>
</head>
<body>
  <div class="container">
${elementsHTML}
  </div>
</body>
</html>`;
  };

  const copyHTML = () => {
    navigator.clipboard.writeText(generateHTML());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getViewportWidth = () => {
    switch (viewport) {
      case "mobile": return "375px";
      case "tablet": return "768px";
      default: return "100%";
    }
  };

  const selectedElement = elements.find(el => el.id === selectedId);

  if (showCode) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setShowCode(false)}
              className="flex items-center gap-2 text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={copyHTML}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copiado!" : "Copiar HTML"}
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([generateHTML()], { type: 'text/html' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'pagina.html';
                  a.click();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-white mb-4">Código HTML</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <pre className="text-sm text-green-400 p-6 overflow-x-auto whitespace-pre-wrap">{generateHTML()}</pre>
          </div>
        </div>
      </div>
    );
  }

  if (showPreview) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setShowPreview(false)}
              className="flex items-center gap-2 text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar ao editor
            </button>
            <h2 className="text-xl font-semibold text-white">Preview</h2>
          </div>
          <div className="bg-white rounded-xl overflow-hidden">
            <iframe
              srcDoc={generateHTML()}
              className="w-full h-[800px] border-0"
              title="Preview"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-white">Simple HTML Builder</h1>
              <p className="text-sm text-gray-500">Construtor Leve e Rápido</p>
            </div>
          </div>

          {/* Viewport Toggles */}
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewport("desktop")}
              className={`p-2 rounded ${viewport === "desktop" ? "bg-gray-700 text-white" : "text-gray-400"}`}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewport("tablet")}
              className={`p-2 rounded ${viewport === "tablet" ? "bg-gray-700 text-white" : "text-gray-400"}`}
            >
              <Tablet className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewport("mobile")}
              className={`p-2 rounded ${viewport === "mobile" ? "bg-gray-700 text-white" : "text-gray-400"}`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCode(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white"
            >
              <Code className="w-4 h-4" />
              HTML
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              <Save className="w-4 h-4" />
              Salvar
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Panel - Elements */}
        <div className="w-64 bg-gray-900 border-r border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
            Adicionar Elementos
          </h3>
          <div className="space-y-2">
            {elementTypes.map((type) => (
              <motion.button
                key={type.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => addElement(type.id)}
                className="w-full flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition-colors"
              >
                <type.icon className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-white">{type.name}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 bg-gray-800/50 p-8 overflow-auto">
          <motion.div
            initial={false}
            animate={{ width: getViewportWidth() }}
            className="mx-auto bg-white rounded-xl min-h-[600px] shadow-2xl transition-all duration-300"
          >
            <div className="p-8">
              {elements.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <Box className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Canvas vazio</p>
                  <p className="text-sm mt-2">Clique nos elementos à esquerda para adicionar</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {elements.map((element, index) => (
                    <motion.div
                      key={element.id}
                      onClick={() => setSelectedId(element.id)}
                      className={`group relative p-4 rounded-lg cursor-pointer transition-all ${
                        selectedId === element.id 
                          ? "ring-2 ring-emerald-500 bg-emerald-50" 
                          : "hover:bg-gray-50 border-2 border-dashed border-gray-200"
                      }`}
                    >
                      {/* Drag handle and controls */}
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveElement(index, "up"); }}
                          disabled={index === 0}
                          className="p-1 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveElement(index, "down"); }}
                          disabled={index === elements.length - 1}
                          className="p-1 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeElement(element.id); }}
                        className="absolute -right-2 -top-2 p-1.5 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>

                      {/* Element Content */}
                      <div style={{ textAlign: (element.styles.align as any) || 'left' }}>
                        {element.type === "heading" && (
                          <h2 className="text-2xl font-bold" style={{ color: element.styles.textColor }}>
                            {element.content}
                          </h2>
                        )}
                        {element.type === "paragraph" && (
                          <p className="text-gray-700 leading-relaxed">
                            {element.content}
                          </p>
                        )}
                        {element.type === "button" && (
                          <button className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg font-medium">
                            {element.content}
                          </button>
                        )}
                        {element.type === "image" && (
                          <div className="bg-gray-100 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                            {element.content.startsWith('http') ? (
                              <img src={element.content} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center text-gray-400">
                                <Image className="w-12 h-12 mx-auto mb-2" />
                                <p className="text-sm">{element.content || "URL da imagem"}</p>
                              </div>
                            )}
                          </div>
                        )}
                        {element.type === "container" && (
                          <div 
                            className="p-6 rounded-lg"
                            style={{ backgroundColor: element.styles.bgColor || '#f3f4f6' }}
                          >
                            <p>{element.content}</p>
                          </div>
                        )}
                        {element.type === "columns" && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-100 p-4 rounded-lg">
                              <p className="text-sm text-gray-500">Coluna 1</p>
                            </div>
                            <div className="bg-gray-100 p-4 rounded-lg">
                              <p className="text-sm text-gray-500">Coluna 2</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Panel - Properties */}
        <div className="w-80 bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
            Propriedades
          </h3>
          
          {selectedElement ? (
            <div className="space-y-4">
              {/* Element Type Badge */}
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">
                  {elementTypes.find(e => e.id === selectedElement.type)?.name}
                </span>
              </div>

              {/* Content Input */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Conteúdo</label>
                {selectedElement.type === "paragraph" ? (
                  <textarea
                    value={selectedElement.content}
                    onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm min-h-[100px]"
                  />
                ) : (
                  <input
                    type="text"
                    value={selectedElement.content}
                    onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                )}
              </div>

              {/* Alignment */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Alinhamento</label>
                <div className="flex gap-2">
                  {["left", "center", "right"].map((align) => (
                    <button
                      key={align}
                      onClick={() => updateElement(selectedElement.id, { 
                        styles: { ...selectedElement.styles, align } 
                      })}
                      className={`flex-1 py-2 rounded-lg text-sm capitalize transition-colors ${
                        selectedElement.styles.align === align
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                      }`}
                    >
                      {align === "left" && "←"}
                      {align === "center" && "↔"}
                      {align === "right" && "→"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colors */}
              {(selectedElement.type === "heading" || selectedElement.type === "container") && (
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Cores</label>
                  <div className="space-y-2">
                    {selectedElement.type === "heading" && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Cor do texto</span>
                        <input
                          type="color"
                          value={selectedElement.styles.textColor || "#000000"}
                          onChange={(e) => updateElement(selectedElement.id, {
                            styles: { ...selectedElement.styles, textColor: e.target.value }
                          })}
                          className="w-10 h-8 rounded cursor-pointer"
                        />
                      </div>
                    )}
                    {selectedElement.type === "container" && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Cor de fundo</span>
                        <input
                          type="color"
                          value={selectedElement.styles.bgColor || "#f3f4f6"}
                          onChange={(e) => updateElement(selectedElement.id, {
                            styles: { ...selectedElement.styles, bgColor: e.target.value }
                          })}
                          className="w-10 h-8 rounded cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Padding */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Espaçamento (padding)</label>
                <select
                  value={selectedElement.styles.padding || "16px"}
                  onChange={(e) => updateElement(selectedElement.id, {
                    styles: { ...selectedElement.styles, padding: e.target.value }
                  })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="8px">Pequeno (8px)</option>
                  <option value="16px">Médio (16px)</option>
                  <option value="24px">Grande (24px)</option>
                  <option value="32px">Extra (32px)</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              Selecione um elemento no canvas para editar suas propriedades
            </div>
          )}

          {/* Stats */}
          <div className="mt-8 pt-6 border-t border-gray-800">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-white">{elements.length}</div>
                <div className="text-xs text-gray-500">Elementos</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-white">{selectedId ? "1" : "0"}</div>
                <div className="text-xs text-gray-500">Selecionados</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
