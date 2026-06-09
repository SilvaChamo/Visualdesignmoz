'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle, Server } from 'lucide-react';

export default function SetupSMTPPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const configureSMTP = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/setup-smtp-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Falha na configuração');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-3">
          <Server className="w-8 h-8 text-red-600" />
          Configurar SMTP do Servidor
        </h1>

        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Configuração Automática</h2>
          <p className="text-gray-600 mb-4">
            Este botão configura o servidor DirectAdmin para aceitar ligações SMTP externas.
          </p>
          
          <Button
            onClick={configureSMTP}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-6 text-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Configurando...
              </>
            ) : (
              <>
                <Server className="w-5 h-5 mr-2" />
                Configurar SMTP Automaticamente
              </>
            )}
          </Button>
        </Card>

        {result && (
          <Card className="p-6 bg-green-50 border-green-200">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-semibold text-green-800">Configuração Executada!</h3>
            </div>
            
            <pre className="bg-black text-green-400 p-4 rounded text-sm overflow-auto max-h-60">
              {result.output}
            </pre>
            
            {result.nextSteps && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Próximos passos:</h4>
                <ul className="list-disc list-inside text-sm text-gray-700">
                  {result.nextSteps.map((step: string, i: number) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}

        {error && (
          <Card className="p-6 bg-red-50 border-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-red-800">Erro</h3>
            </div>
            <p className="mt-2 text-red-700">{error}</p>
            
            <div className="mt-4 p-4 bg-yellow-50 rounded">
              <p className="text-sm text-yellow-800">
                <strong>Alternativa manual:</strong> Execute os comandos no ficheiro QUICK-SETUP.txt no servidor via SSH.
              </p>
            </div>
          </Card>
        )}

        <Card className="p-6 mt-6">
          <h3 className="font-semibold mb-2">Informações do Servidor</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li><strong>Host:</strong> 109.199.104.22</li>
            <li><strong>Usuário:</strong> ADMIN</li>
            <li><strong>Portas:</strong> 587 (STARTTLS), 465 (SSL)</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
