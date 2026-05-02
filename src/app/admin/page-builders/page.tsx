"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  Layers, 
  Palette, 
  Code, 
  ArrowLeft,
  Sparkles,
  Grid3X3,
  Type,
  Image,
  Box,
  Download,
  Eye,
  Save,
  Trash2
} from "lucide-react";
import Link from "next/link";
import CraftBuilder from "./components/CraftBuilder";
import GrapesBuilder from "./components/GrapesBuilder";
import SimpleBuilder from "./components/SimpleBuilder";

const builders = [
  {
    id: "craft",
    name: "Craft.js Builder",
    description: "Construtor moderno em React com componentes arrastáveis. Ideal para landing pages complexas.",
    icon: Layers,
    color: "from-blue-500 to-cyan-500",
    features: ["Componentes React", "Preview em tempo real", "Exporta JSON/JSX"],
  },
  {
    id: "grapes",
    name: "GrapesJS Studio",
    description: "Editor visual profissional que exporta HTML/CSS puro. Compatível com todos os navegadores.",
    icon: Palette,
    color: "from-purple-500 to-pink-500",
    features: ["Exporta HTML/CSS", "Blocos pré-definidos", "Responsive design"],
  },
  {
    id: "simple",
    name: "Simple HTML Builder",
    description: "Construtor leve e rápido para páginas simples. Interface minimalista e intuitiva.",
    icon: Code,
    color: "from-green-500 to-emerald-500",
    features: ["HTML puro", "Carregamento rápido", "Fácil de usar"],
  },
];

export default function PageBuildersPage() {
  const [selectedBuilder, setSelectedBuilder] = useState<string | null>(null);

  if (selectedBuilder === "craft") {
    return <CraftBuilder onBack={() => setSelectedBuilder(null)} />;
  }

  if (selectedBuilder === "grapes") {
    return <GrapesBuilder onBack={() => setSelectedBuilder(null)} />;
  }

  if (selectedBuilder === "simple") {
    return <SimpleBuilder onBack={() => setSelectedBuilder(null)} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link 
              href="/admin" 
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Construtores de Páginas</h1>
              <p className="text-gray-400 mt-1">
                Escolha um dos 3 construtores para criar páginas profissionais
              </p>
            </div>
          </div>
        </div>

        {/* Builders Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {builders.map((builder) => (
            <motion.div
              key={builder.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group cursor-pointer"
              onClick={() => setSelectedBuilder(builder.id)}
            >
              <div className="relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all">
                {/* Gradient Header */}
                <div className={`h-32 bg-gradient-to-br ${builder.color} relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <builder.icon className="w-16 h-16 text-white/90" />
                  </div>
                  {/* Decorative elements */}
                  <div className="absolute top-4 right-4 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
                  <div className="absolute bottom-4 left-4 w-16 h-16 bg-black/20 rounded-full blur-xl" />
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                    {builder.name}
                  </h3>
                  <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                    {builder.description}
                  </p>

                  {/* Features */}
                  <div className="space-y-2">
                    {builder.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-500">
                        <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${builder.color}`} />
                        {feature}
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <div className="mt-6">
                    <div className={`w-full py-3 px-4 bg-gradient-to-r ${builder.color} rounded-xl text-white font-medium text-center group-hover:shadow-lg group-hover:shadow-${builder.color.split('-')[1]}-500/25 transition-all`}>
                      Abrir Construtor
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-12 bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-indigo-400" />
            Como usar os construtores
          </h3>
          <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-400">
            <div>
              <strong className="text-white block mb-1">1. Escolha o construtor</strong>
              Cada um tem características diferentes. Craft.js é mais avançado, GrapesJS exporta HTML puro, e Simple é mais rápido.
            </div>
            <div>
              <strong className="text-white block mb-1">2. Arraste componentes</strong>
              Todos usam drag-and-drop. Arraste blocos para a área de trabalho e organize como quiser.
            </div>
            <div>
              <strong className="text-white block mb-1">3. Exporte ou salve</strong>
              Exporte como HTML, JSON ou salve diretamente no sistema para usar em sites de clientes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
