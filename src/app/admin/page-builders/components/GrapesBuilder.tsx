"use client";

import React, { useEffect, useRef, useState } from "react";
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
  Undo,
  Redo,
  Trash2,
  Layers,
  Palette,
  Type,
  Image,
  Square,
  Columns,
  Video,
  MapPin,
  ShoppingCart,
  Star,
  MousePointer
} from "lucide-react";

interface GrapesBuilderProps {
  onBack: () => void;
}

export default function GrapesBuilder({ onBack }: GrapesBuilderProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [htmlOutput, setHtmlOutput] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const getViewportWidth = () => {
    switch (viewport) {
      case "mobile": return "375px";
      case "tablet": return "768px";
      default: return "100%";
    }
  };

  const exportHTML = () => {
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Página Criada com GrapesJS</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 80px 20px; text-align: center; }
    .section { padding: 60px 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; }
    .card { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    h1 { font-size: 3rem; margin-bottom: 20px; }
    h2 { font-size: 2rem; margin-bottom: 20px; }
    p { line-height: 1.6; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="hero">
    <div class="container">
      <h1>Sua Página Profissional</h1>
      <p>Criada com GrapesJS no VisualDesign</p>
      <a href="#" class="btn">Começar Agora</a>
    </div>
  </div>
  
  <div class="section">
    <div class="container">
      <h2>Nossos Serviços</h2>
      <div class="grid">
        <div class="card">
          <h3>Design Profissional</h3>
          <p>Criamos interfaces modernas e responsivas para seu negócio.</p>
        </div>
        <div class="card">
          <h3>Marketing Digital</h3>
          <p>Estratégias completas para alcançar mais clientes.</p>
        </div>
        <div class="card">
          <h3>Desenvolvimento Web</h3>
          <p>Sites rápidos, seguros e otimizados para conversão.</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
    setHtmlOutput(html);
    setShowCode(true);
  };

  if (showCode) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setShowCode(false)}
              className="flex items-center gap-2 text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar ao editor
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(htmlOutput)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Copiar HTML
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([htmlOutput], { type: 'text/html' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'pagina.html';
                  a.click();
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Download .html
              </button>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-white mb-4">Código HTML Exportado</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <pre className="text-sm text-green-400 p-6 overflow-x-auto whitespace-pre-wrap">{htmlOutput}</pre>
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
              <h1 className="text-lg font-semibold text-white">GrapesJS Studio</h1>
              <p className="text-sm text-gray-500">Editor Visual Profissional</p>
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
              onClick={exportHTML}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white"
            >
              <Code className="w-4 h-4" />
              HTML
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              <Save className="w-4 h-4" />
              Salvar
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Sidebar - Blocks */}
        <div className="w-72 bg-gray-900 border-r border-gray-800 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
              Blocos
            </h3>
            
            {/* Section: Basic */}
            <div className="mb-6">
              <h4 className="text-xs text-gray-500 uppercase mb-2">Básicos</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-move hover:bg-gray-700">
                  <Type className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-white">Título</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-move hover:bg-gray-700">
                  <Type className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-white">Texto</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-move hover:bg-gray-700">
                  <Image className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-white">Imagem</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-move hover:bg-gray-700">
                  <Square className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-white">Botão</span>
                </div>
              </div>
            </div>

            {/* Section: Layout */}
            <div className="mb-6">
              <h4 className="text-xs text-gray-500 uppercase mb-2">Layout</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-move hover:bg-gray-700">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-white">Container</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-move hover:bg-gray-700">
                  <Columns className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-white">2 Colunas</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-move hover:bg-gray-700">
                  <Columns className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-white">3 Colunas</span>
                </div>
              </div>
            </div>

            {/* Section: Advanced */}
            <div className="mb-6">
              <h4 className="text-xs text-gray-500 uppercase mb-2">Avançado</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-move hover:bg-gray-700">
                  <Video className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-white">Vídeo</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-move hover:bg-gray-700">
                  <MapPin className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-white">Mapa</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-move hover:bg-gray-700">
                  <ShoppingCart className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-white">Produto</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-move hover:bg-gray-700">
                  <Star className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-white">Avaliação</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-gray-800/50 p-8 overflow-auto">
          <motion.div
            initial={false}
            animate={{ width: getViewportWidth() }}
            className="mx-auto bg-white rounded-xl min-h-[800px] shadow-2xl transition-all duration-300 overflow-hidden"
          >
            {/* Simulated GrapesJS Editor */}
            <div className="h-full">
              {/* Toolbar */}
              <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
                <button className="p-1.5 hover:bg-gray-200 rounded">
                  <Undo className="w-4 h-4 text-gray-600" />
                </button>
                <button className="p-1.5 hover:bg-gray-200 rounded">
                  <Redo className="w-4 h-4 text-gray-600" />
                </button>
                <div className="w-px h-4 bg-gray-300 mx-2" />
                <select className="text-sm bg-white border border-gray-300 rounded px-2 py-1">
                  <option>Arial</option>
                  <option>Inter</option>
                  <option>Roboto</option>
                </select>
                <select className="text-sm bg-white border border-gray-300 rounded px-2 py-1 w-20">
                  <option>14px</option>
                  <option>16px</option>
                  <option>18px</option>
                  <option>24px</option>
                </select>
                <div className="w-px h-4 bg-gray-300 mx-2" />
                <button className="p-1.5 hover:bg-gray-200 rounded font-bold text-gray-600">B</button>
                <button className="p-1.5 hover:bg-gray-200 rounded italic text-gray-600">I</button>
                <button className="p-1.5 hover:bg-gray-200 rounded underline text-gray-600">U</button>
              </div>

              {/* Canvas Content - Preview */}
              <div className="p-0">
                {/* Hero Section */}
                <div className="bg-gradient-to-br from-purple-600 to-blue-600 text-white p-16 text-center group relative">
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 bg-white/20 rounded text-white">
                      <MousePointer className="w-4 h-4" />
                    </button>
                  </div>
                  <h1 className="text-4xl font-bold mb-4">Bem-vindo ao GrapesJS</h1>
                  <p className="text-xl text-white/90 mb-8">Arraste blocos da esquerda para começar</p>
                  <button className="px-6 py-3 bg-white text-purple-600 rounded-lg font-medium">
                    Clique para editar
                  </button>
                </div>

                {/* Content Section */}
                <div className="p-12 max-w-4xl mx-auto">
                  <div className="grid md:grid-cols-3 gap-8">
                    <div className="p-6 bg-gray-50 rounded-xl group relative hover:shadow-lg transition-shadow">
                      <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded">Editar</div>
                      </div>
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                        <Palette className="w-6 h-6 text-purple-600" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Design Flexível</h3>
                      <p className="text-gray-600">Crie layouts responsivos com facilidade usando nossa interface drag-and-drop.</p>
                    </div>

                    <div className="p-6 bg-gray-50 rounded-xl group relative hover:shadow-lg transition-shadow">
                      <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded">Editar</div>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                        <Code className="w-6 h-6 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Código Limpo</h3>
                      <p className="text-gray-600">Exporte HTML/CSS semântico e otimizado para melhor performance.</p>
                    </div>

                    <div className="p-6 bg-gray-50 rounded-xl group relative hover:shadow-lg transition-shadow">
                      <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded">Editar</div>
                      </div>
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                        <Layers className="w-6 h-6 text-green-600" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Blocos Prontos</h3>
                      <p className="text-gray-600">Use componentes pré-construídos para acelerar seu fluxo de trabalho.</p>
                    </div>
                  </div>
                </div>

                {/* Call to Action */}
                <div className="bg-gray-900 text-white p-12 text-center">
                  <h2 className="text-3xl font-bold mb-4">Pronto para começar?</h2>
                  <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
                    Exporte esta página ou continue editando para criar algo único para seu cliente.
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button 
                      onClick={exportHTML}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                    >
                      Exportar HTML
                    </button>
                    <button className="px-6 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700">
                      Preview
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Panel - Style Manager */}
        <div className="w-72 bg-gray-900 border-l border-gray-800 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
              Estilos
            </h3>
            
            {/* Dimensions */}
            <div className="mb-6">
              <h4 className="text-xs text-gray-500 uppercase mb-3">Dimensões</h4>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-xs text-gray-600">Largura</label>
                  <input type="text" value="auto" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Altura</label>
                  <input type="text" value="auto" className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1">
                <input type="text" placeholder="Top" className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white text-center" />
                <input type="text" placeholder="Right" className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white text-center" />
                <input type="text" placeholder="Bottom" className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white text-center" />
                <input type="text" placeholder="Left" className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white text-center" />
              </div>
            </div>

            {/* Typography */}
            <div className="mb-6">
              <h4 className="text-xs text-gray-500 uppercase mb-3">Tipografia</h4>
              <div className="space-y-2">
                <select className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white">
                  <option>Font Family</option>
                  <option>Arial</option>
                  <option>Georgia</option>
                  <option>Inter</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white">
                    <option>Tamanho</option>
                    <option>12px</option>
                    <option>14px</option>
                    <option>16px</option>
                  </select>
                  <select className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white">
                    <option>Peso</option>
                    <option>Normal</option>
                    <option>Bold</option>
                    <option>Light</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Colors */}
            <div className="mb-6">
              <h4 className="text-xs text-gray-500 uppercase mb-3">Cores</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input type="color" value="#ffffff" className="w-8 h-8 rounded cursor-pointer" />
                  <span className="text-sm text-gray-400">Cor do texto</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" value="#6366f1" className="w-8 h-8 rounded cursor-pointer" />
                  <span className="text-sm text-gray-400">Cor de fundo</span>
                </div>
              </div>
            </div>

            {/* Decorations */}
            <div>
              <h4 className="text-xs text-gray-500 uppercase mb-3">Decorações</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Borda</span>
                  <input type="text" placeholder="1px solid" className="w-24 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Radius</span>
                  <input type="text" placeholder="8px" className="w-24 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Sombra</span>
                  <select className="w-24 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white">
                    <option>None</option>
                    <option>Small</option>
                    <option>Medium</option>
                    <option>Large</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
