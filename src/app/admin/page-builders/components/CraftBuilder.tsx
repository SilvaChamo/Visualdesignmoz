"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  Save, 
  Download, 
  Eye, 
  Trash2, 
  Undo,
  Redo,
  Monitor,
  Smartphone,
  Tablet,
  Type,
  Image as ImageIcon,
  Box,
  Layout,
  Grid3X3,
  MousePointerClick as ButtonIcon,
  SeparatorHorizontal as SeparatorIcon,
  Video,
  MapPin,
  Star,
  Quote
} from "lucide-react";

// Componentes simulados do Craft.js (para demonstração)
// Em produção, importaria de @craftjs/core

interface CraftBuilderProps {
  onBack: () => void;
}

const componentes = [
  { id: "texto", name: "Texto", icon: Type, desc: "Títulos e parágrafos" },
  { id: "imagem", name: "Imagem", icon: ImageIcon, desc: "Fotos e galerias" },
  { id: "botao", name: "Botão", icon: ButtonIcon, desc: "CTAs e links" },
  { id: "container", name: "Container", icon: Box, desc: "Seção com fundo" },
  { id: "colunas", name: "Colunas", icon: Grid3X3, desc: "Layout grid" },
  { id: "divisor", name: "Divisor", icon: SeparatorIcon, desc: "Linha separadora" },
  { id: "video", name: "Vídeo", icon: Video, desc: "YouTube/Vimeo" },
  { id: "mapa", name: "Mapa", icon: MapPin, desc: "Google Maps" },
  { id: "depoimento", name: "Depoimento", icon: Quote, desc: "Card de review" },
  { id: "avaliacao", name: "Avaliação", icon: Star, desc: "Estrelas rating" },
];

export default function CraftBuilder({ onBack }: CraftBuilderProps) {
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [canvasItems, setCanvasItems] = useState<Array<{id: string, type: string}>>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [jsonOutput, setJsonOutput] = useState("");

  const addComponent = (componentId: string) => {
    setCanvasItems(prev => [...prev, { id: Date.now().toString(), type: componentId }]);
  };

  const removeItem = (id: string) => {
    setCanvasItems(prev => prev.filter(item => item.id !== id));
  };

  const exportJSON = () => {
    const output = JSON.stringify({ components: canvasItems }, null, 2);
    setJsonOutput(output);
  };

  const getViewportWidth = () => {
    switch (viewport) {
      case "mobile": return "375px";
      case "tablet": return "768px";
      default: return "100%";
    }
  };

  if (showPreview) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setShowPreview(false)}
              className="flex items-center gap-2 text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar ao editor
            </button>
            <h2 className="text-xl font-semibold text-white">Preview da Página</h2>
          </div>
          <div className="bg-white rounded-xl p-8 min-h-[600px]">
            {canvasItems.length === 0 ? (
              <div className="text-center text-gray-400 py-20">
                <Layout className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Adicione componentes para ver o preview</p>
              </div>
            ) : (
              <div className="space-y-4">
                {canvasItems.map((item) => (
                  <div key={item.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <span className="text-gray-600 font-medium capitalize">{item.type}</span>
                    <p className="text-sm text-gray-400 mt-1">Componente {item.type} - conteúdo de exemplo</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (jsonOutput) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setJsonOutput("")}
              className="flex items-center gap-2 text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h2 className="text-xl font-semibold text-white">Exportação JSON</h2>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <pre className="text-green-400 text-sm overflow-x-auto">{jsonOutput}</pre>
            <button
              onClick={() => navigator.clipboard.writeText(jsonOutput)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Copiar JSON
            </button>
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
              <h1 className="text-lg font-semibold text-white">Craft.js Builder</h1>
              <p className="text-sm text-gray-500">Construtor React Profissional</p>
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
              onClick={exportJSON}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white"
            >
              <Download className="w-4 h-4" />
              JSON
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              <Save className="w-4 h-4" />
              Salvar
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar - Components */}
        <div className="w-72 bg-gray-900 border-r border-gray-800 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
              Componentes
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {componentes.map((comp) => (
                <motion.button
                  key={comp.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => addComponent(comp.id)}
                  className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition-colors"
                >
                  <comp.icon className="w-5 h-5 text-indigo-400 mb-2" />
                  <div className="text-sm font-medium text-white">{comp.name}</div>
                  <div className="text-xs text-gray-500">{comp.desc}</div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-gray-800/50 p-8 overflow-auto">
          <motion.div
            initial={false}
            animate={{ width: getViewportWidth() }}
            className="mx-auto bg-white rounded-xl min-h-[800px] shadow-2xl transition-all duration-300"
          >
            <div className="p-8">
              {canvasItems.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <Layout className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Canvas vazio</p>
                  <p className="text-sm mt-2">Clique nos componentes à esquerda para adicionar</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {canvasItems.map((item, index) => {
                    const compInfo = componentes.find(c => c.id === item.type);
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group relative p-6 border-2 border-dashed border-gray-300 hover:border-indigo-400 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {compInfo && <compInfo.icon className="w-5 h-5 text-gray-400" />}
                          <span className="font-medium text-gray-700 capitalize">{item.type}</span>
                          <span className="text-sm text-gray-400">Componente #{index + 1}</span>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="absolute top-2 right-2 p-2 text-red-400 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Panel - Properties */}
        <div className="w-72 bg-gray-900 border-l border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
            Propriedades
          </h3>
          <div className="text-sm text-gray-500">
            Selecione um componente no canvas para editar suas propriedades
          </div>
          <div className="mt-6 p-4 bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500 mb-2">Estatísticas</div>
            <div className="text-2xl font-bold text-white">{canvasItems.length}</div>
            <div className="text-xs text-gray-400">componentes adicionados</div>
          </div>
        </div>
      </div>
    </div>
  );
}
