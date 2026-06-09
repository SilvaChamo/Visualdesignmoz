'use client';

import { useState } from 'react';
import { Loader2, FolderOpen, Mail, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function EmailDiagnosticoPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('silva.chamo@visualdesignmoz.com');
  const [password, setPassword] = useState('');

  async function checkFolders() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/debug-imap-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: 'Falha ao verificar pastas IMAP' });
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FolderOpen className="w-7 h-7 text-cyan-600" />
              Diagnóstico IMAP
            </h1>
          </div>
        </div>

        <p className="text-gray-600">
          Verifique quais pastas existem no servidor IMAP e seus nomes reais.
        </p>

        {/* Formulário */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={checkFolders}
                disabled={loading || !email || !password}
                className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 text-white px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
                {loading ? 'Verificando...' : 'Verificar Pastas'}
              </button>
            </div>
          </div>
        </div>

        {/* Resultado */}
        {result && (
          <div className={`rounded-xl border shadow-sm p-6 ${result.success ? 'bg-white border-green-200' : 'bg-red-50 border-red-200'}`}>
            <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${result.success ? 'text-gray-900' : 'text-red-800'}`}>
              {result.success ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
              {result.success ? 'Diagnóstico Concluído' : 'Erro no Diagnóstico'}
            </h2>

            {result.success && (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Total de pastas encontradas: <span className="font-semibold text-gray-900">{result.allFolders?.length}</span>
                </p>

                {/* Pastas Comuns */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Pastas Padrão do Webmail:</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(result.commonFolders || {}).map(([name, status]: [string, any]) => (
                      <div
                        key={name}
                        className={`p-3 rounded-lg border ${
                          status.exists
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-medium text-sm ${status.exists ? 'text-green-800' : 'text-red-800'}`}>
                            {name}
                          </span>
                          {status.exists ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                        {status.exists && (
                          <p className="text-xs text-green-600 mt-1">
                            {status.total} emails
                          </p>
                        )}
                        {!status.exists && status.error && (
                          <p className="text-xs text-red-500 mt-1">
                            Não existe
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Todas as Pastas */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Todas as Pastas no Servidor:</h3>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-700">
                          <th className="text-left py-2 px-3">Caminho</th>
                          <th className="text-left py-2 px-3">Flags</th>
                          <th className="text-left py-2 px-3">Uso Especial</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.allFolders?.map((folder: any, idx: number) => (
                          <tr key={idx} className="text-gray-300 border-b border-gray-800">
                            <td className="py-2 px-3 font-mono text-cyan-400">{folder.path}</td>
                            <td className="py-2 px-3">{folder.flags?.join(', ') || '-'}</td>
                            <td className="py-2 px-3">{folder.specialUse || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {result.error && (
              <div className="bg-red-100 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">Erro:</p>
                <pre className="mt-2 text-sm text-red-600 font-mono">{result.error}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
