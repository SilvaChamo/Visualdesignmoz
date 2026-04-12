"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-10 h-10 text-amber-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 mb-3">
          Sem Ligação à Internet
        </h1>
        
        <p className="text-slate-600 mb-6">
          Não foi possível ligar ao servidor. Algumas funcionalidades podem estar indisponíveis offline.
        </p>
        
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Pode continuar a usar a aplicação. Os dados serão sincronizados quando a ligação for restabelecida.
          </p>
          
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    </div>
  );
}
