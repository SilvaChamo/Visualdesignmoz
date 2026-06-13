"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isClientPage, setIsClientPage] = useState(false);

  useEffect(() => {
    // Verifica se já está instalado
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Verifica se está na página /client
    const isClient = window.location.pathname.startsWith("/client");
    setIsClientPage(isClient);
    if (!isClient) return;

    // Verifica se usuário clicou "Nunca" (não mostrar mais)
    const neverShow = localStorage.getItem("pwa-prompt-never");
    if (neverShow) return;

    // Verifica se deve lembrar ao fechar (clicou "Lembrar mais tarde")
    const remindOnExit = localStorage.getItem("pwa-remind-on-exit") === "true";

    // Captura o evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Detecta se app já foi instalado
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      localStorage.setItem("pwa-installed", "true");
      localStorage.removeItem("pwa-remind-on-exit");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Mostra prompt após 1 minuto (60 segundos) na página /client
    const timer = setTimeout(() => {
      if (!neverShow && !isInstalled && isClient) {
        setShowPrompt(true);
      }
    }, 60000); // 1 minuto

    // Se clicou "lembrar mais tarde", mostra quando fecha a página
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (localStorage.getItem("pwa-remind-on-exit") === "true") {
        // Não mostra popup de confirmação do navegador, apenas prepara para próxima vez
        localStorage.removeItem("pwa-remind-on-exit");
        localStorage.setItem("pwa-show-on-next-visit", "true");
      }
    };

    // Verifica se deve mostrar por causa de visita anterior (lembrar mais tarde)
    const shouldShowFromPrevious = localStorage.getItem("pwa-show-on-next-visit") === "true";
    if (shouldShowFromPrevious && !neverShow && !isInstalled) {
      localStorage.removeItem("pwa-show-on-next-visit");
      // Não mostra imediatamente, espera o minuto normal
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearTimeout(timer);
    };
  }, [isInstalled]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        localStorage.setItem("pwa-installed", "true");
        localStorage.removeItem("pwa-remind-on-exit");
        localStorage.removeItem("pwa-show-on-next-visit");
      }
    }
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    // Clicou "Não" (X) - nunca mais mostrar
    setShowPrompt(false);
    localStorage.setItem("pwa-prompt-never", "true");
    localStorage.removeItem("pwa-remind-on-exit");
    localStorage.removeItem("pwa-show-on-next-visit");
  };

  const handleRemindLater = () => {
    // Clicou "Lembrar mais tarde" - mostra quando fechar a página
    setShowPrompt(false);
    localStorage.setItem("pwa-remind-on-exit", "true");
  };

  // Só mostra se estiver na página /client, não instalado, e showPrompt true
  if (!showPrompt || isInstalled || !isClientPage) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-bottom-2 duration-300">
      <div className="site-overlay-panel bg-white dark:bg-zinc-950 rounded-lg shadow-lg border border-slate-200 dark:border-zinc-800 p-3 max-w-[280px]">
        {/* Header minimalista */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 leading-tight">Instalar App</h3>
              <p className="text-xs text-slate-500">Acesso rápido & offline</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-slate-100 rounded transition-colors flex-shrink-0 ml-2"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Botões minimalistas */}
        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded transition-colors"
          >
            Instalar
          </button>
          <button
            onClick={handleRemindLater}
            className="py-1.5 px-3 text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-xs font-medium rounded transition-colors"
          >
            Depois
          </button>
        </div>
      </div>
    </div>
  );
}
