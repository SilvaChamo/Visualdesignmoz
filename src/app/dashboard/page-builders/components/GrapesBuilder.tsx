"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Save, AlertCircle, Loader2 } from "lucide-react";

interface GrapesBuilderProps {
  onBack: () => void;
}

export default function GrapesBuilder({ onBack }: GrapesBuilderProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Previne execução dupla que causa erros em React Strict Mode
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Função utilitária para carregar scripts bypassando o Next.js
    const loadScript = (src: string) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve(true);
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Falha ao carregar o script: ${src}`));
        document.head.appendChild(script);
      });
    };

    const buildEditor = async () => {
      try {
        console.log("[SISTEMA] A injetar motor puro...");
        
        // 1. Carregar GrapesJS Oficial (Local)
        await loadScript("/vendor/grapesjs/grapes.min.js");
        
        // 2. Carregar Plugins (Local)
        await loadScript("/vendor/grapesjs/grapesjs-preset-webpage.js");
        await loadScript("/vendor/grapesjs/grapesjs-blocks-basic.js");

        // Obter referências globais puras
        const grapesjs = (window as any).grapesjs;
        const wpPlugin = (window as any)["grapesjs-preset-webpage"];
        const bbPlugin = (window as any)["grapesjs-blocks-basic"];

        if (!grapesjs) throw new Error("A biblioteca base GrapesJS não foi encontrada.");
        if (!editorRef.current) return;

        // 3. Inicializar o Editor
        const editor = grapesjs.init({
          container: editorRef.current,
          fromElement: true,
          height: 'calc(100vh - 64px)',
          width: '100%',
          storageManager: false, // Desligamos o armazenamento local
          plugins: [
            wpPlugin ? wpPlugin : 'gjs-preset-webpage', 
            bbPlugin ? bbPlugin : 'gjs-blocks-basic'
          ],
          pluginsOpts: {
            [wpPlugin ? wpPlugin : 'gjs-preset-webpage']: {},
            [bbPlugin ? bbPlugin : 'gjs-blocks-basic']: { flexGrid: true }
          }
        });

        // 4. Adicionar um template simples para começar
        editor.on('load', () => {
          setLoading(false);
          editor.setComponents(`
            <div style="padding: 50px; text-align: center; font-family: sans-serif;">
              <h1 style="font-size: 3rem;">Motor Limpo Iniciado</h1>
              <p style="color: #666;">A interface nativa está pronta. Arraste os blocos à esquerda.</p>
            </div>
          `);
        });

        // Fallback de segurança para desligar o loader
        setTimeout(() => setLoading(false), 4000);

        // Guardar referência para o botão Gravar
        (window as any).editor = editor;

      } catch (err: any) {
        console.error("[ERRO FATAL]", err);
        setError("Ocorreu um erro ao construir a interface pura: " + err.message);
        setLoading(false);
      }
    };

    buildEditor();

  }, []);

  return (
    <>
      {/* Estilos Puros carregados diretamente no HTML do componente */}
      <link rel="stylesheet" href="/vendor/grapesjs/css/grapes.min.css" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" />
      
      <div className="h-screen bg-[#1e1e1e] flex flex-col overflow-hidden text-white font-sans">
        {/* Barra Superior */}
        <div className="bg-[#2d2d2d] border-b border-black h-16 px-6 flex items-center justify-between z-50 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 text-gray-400 hover:text-white transition-colors rounded">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-gray-700" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">GrapesJS Nativo</span>
              <span className="text-[9px] font-bold text-gray-500 uppercase">Status: {loading ? 'Construindo...' : 'Operacional'}</span>
            </div>
          </div>

          <button 
            onClick={() => {
              const edt = (window as any).editor;
              if (edt) alert("Pronto para enviar para o Supabase Contabo!");
            }}
            className="px-6 py-2 bg-blue-600 text-white text-[10px] font-black uppercase shadow-xl hover:bg-blue-700 rounded transition-colors"
          >
            <Save className="w-4 h-4 inline mr-2" /> Gravar Online
          </button>
        </div>

        {/* Área do Editor */}
        <div className="flex-1 relative w-full h-full">
          {loading && (
            <div className="absolute inset-0 z-[100] bg-[#1e1e1e] flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 animate-pulse">A Montar Interface Nativa...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 z-[100] bg-red-950 flex flex-col items-center justify-center p-10 text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
              <h2 className="text-2xl font-black uppercase text-white mb-2">Construção Falhou</h2>
              <p className="text-xs text-red-300 font-mono bg-black/50 p-4 rounded mb-6 max-w-md">{error}</p>
              <button onClick={() => window.location.reload()} className="px-8 py-3 bg-white text-black font-black uppercase text-[10px] rounded hover:bg-gray-200 transition-colors">Tentar Novamente</button>
            </div>
          )}

          <div ref={editorRef} id="gjs" className="h-full w-full border-none outline-none" />
        </div>
      </div>
    </>
  );
}
