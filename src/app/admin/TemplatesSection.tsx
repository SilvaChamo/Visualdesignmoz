'use client'

import { useState } from 'react'
import { 
  Palette,
  MessageSquare,
  Save,
  Undo2,
  Variable,
  Mail,
  Eye
} from 'lucide-react'
import { defaultRenewalTemplates, RenewalTemplate, processTemplate, TemplateVariables } from '@/lib/renewal-templates'

export function TemplatesSection() {
  const [templates, setTemplates] = useState<RenewalTemplate[]>(defaultRenewalTemplates)
  const [selectedTemplate, setSelectedTemplate] = useState<RenewalTemplate | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<RenewalTemplate | null>(null)
  const [previewVariables, setPreviewVariables] = useState<TemplateVariables>({
    clientName: 'João Silva',
    serviceName: 'exemplo.com',
    expirationDate: '31/12/2025',
    daysRemaining: 60,
    renewalPrice: '15.00 MT',
    renewalLink: 'https://visualdesigne.com/renovar',
    companyName: 'VisualDesign',
    supportEmail: 'suporte@visualdesigne.com',
    supportPhone: '+351 912 345 678'
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Palette className="w-5 h-5 text-purple-600" />
            Editor de Templates de Notificação
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Personalize as mensagens de renovação enviadas aos clientes
          </p>
        </div>
        {editingTemplate && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? editingTemplate : t))
                setEditingTemplate(null)
                alert('✅ Template salvo!')
              }}
              className="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded font-bold hover:bg-emerald-100 hover:text-emerald-700 flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              Salvar Alterações
            </button>
            <button
              onClick={() => setEditingTemplate(null)}
              className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-600 font-bold rounded hover:bg-gray-100 hover:text-gray-700 transition-colors flex items-center gap-2"
            >
              <Undo2 className="w-4 h-4" />
              Cancelar
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Templates */}
        <div className="lg:col-span-1 space-y-3">
          <h4 className="font-medium text-gray-700 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Templates Disponíveis ({templates.length})
          </h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {templates.map(template => (
              <div
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template)
                  setEditingTemplate({ ...template })
                }}
                className={`p-3 rounded border cursor-pointer transition-colors ${
                  editingTemplate?.id === template.id
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    template.urgency === 'critical' ? 'bg-red-500' :
                    template.urgency === 'high' ? 'bg-orange-500' :
                    template.urgency === 'medium' ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`} />
                  <span className="font-medium text-sm">{template.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span className="px-2 py-0.5 bg-gray-100 rounded">
                    {template.daysBefore === 0 ? 'Confirmação' : `${template.daysBefore} dias`}
                  </span>
                  <span className={`px-2 py-0.5 rounded ${
                    template.type === 'error' ? 'bg-red-100 text-red-700' :
                    template.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                    template.type === 'success' ? 'bg-green-100 text-green-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {template.type}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Variáveis Disponíveis */}
          <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
            <h4 className="font-medium text-blue-900 flex items-center gap-2 mb-3">
              <Variable className="w-4 h-4" />
              Variáveis Disponíveis
            </h4>
            <p className="text-xs text-blue-700 mb-2">
              Use estas variáveis nos templates:
            </p>
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{clientName}}'}</code>
                <span className="text-blue-600">Nome do cliente</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{serviceName}}'}</code>
                <span className="text-blue-600">Domínio/Serviço</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{expirationDate}}'}</code>
                <span className="text-blue-600">Data de vencimento</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{daysRemaining}}'}</code>
                <span className="text-blue-600">Dias restantes</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{renewalPrice}}'}</code>
                <span className="text-blue-600">Preço</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{renewalLink}}'}</code>
                <span className="text-blue-600">Link de renovação</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{companyName}}'}</code>
                <span className="text-blue-600">VisualDesign</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{supportEmail}}'}</code>
                <span className="text-blue-600">Email suporte</span>
              </div>
              <div className="flex justify-between">
                <code className="text-blue-800">{'{{supportPhone}}'}</code>
                <span className="text-blue-600">Telefone</span>
              </div>
            </div>
          </div>
        </div>

        {/* Editor e Preview */}
        <div className="lg:col-span-2 space-y-6">
          {editingTemplate ? (
            <>
              {/* Editor */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                      Dias antes do vencimento
                    </label>
                    <input
                      type="number"
                      value={editingTemplate.daysBefore}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, daysBefore: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Corpo do Email (suporta HTML)
                  </label>
                  <textarea
                    value={editingTemplate.emailBody}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, emailBody: e.target.value })}
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-4">
                  <Eye className="w-5 h-5" />
                  Preview ao Vivo
                </h4>
                
                {/* Preview Dashboard */}
                <div className={`p-4 rounded border-l-4 mb-4 ${
                  editingTemplate.type === 'error' ? 'bg-red-50 border-red-400' :
                  editingTemplate.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                  editingTemplate.type === 'success' ? 'bg-green-50 border-green-400' :
                  'bg-blue-50 border-blue-400'
                }`}>
                  <p className="font-medium">
                    {processTemplate(editingTemplate, previewVariables).title}
                  </p>
                  <p className="text-sm mt-1 opacity-80">
                    {processTemplate(editingTemplate, previewVariables).message}
                  </p>
                </div>

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

                {/* Editar Variáveis de Preview */}
                <div className="mt-4 p-4 bg-gray-50 rounded">
                  <p className="text-sm font-medium text-gray-700 mb-2">Editar Variáveis de Preview:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <input
                      type="text"
                      value={previewVariables.clientName}
                      onChange={(e) => setPreviewVariables({ ...previewVariables, clientName: e.target.value })}
                      placeholder="Nome do cliente"
                      className="px-2 py-1 border rounded"
                    />
                    <input
                      type="text"
                      value={previewVariables.serviceName}
                      onChange={(e) => setPreviewVariables({ ...previewVariables, serviceName: e.target.value })}
                      placeholder="Nome do serviço"
                      className="px-2 py-1 border rounded"
                    />
                    <input
                      type="text"
                      value={previewVariables.expirationDate}
                      onChange={(e) => setPreviewVariables({ ...previewVariables, expirationDate: e.target.value })}
                      placeholder="Data de vencimento"
                      className="px-2 py-1 border rounded"
                    />
                    <input
                      type="text"
                      value={previewVariables.renewalPrice}
                      onChange={(e) => setPreviewVariables({ ...previewVariables, renewalPrice: e.target.value })}
                      placeholder="Preço"
                      className="px-2 py-1 border rounded"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded border-2 border-dashed border-gray-200">
              <Palette className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Selecione um template à esquerda para editar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
