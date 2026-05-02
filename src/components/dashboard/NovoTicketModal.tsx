'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface NovoTicketModalProps {
  isOpen: boolean
  onClose: () => void
  cliente: any
  sites: any[]
  onTicketCreated: () => void
}

export function NovoTicketModal({ isOpen, onClose, cliente, sites, onTicketCreated }: NovoTicketModalProps) {
  const [form, setForm] = useState({
    nome: '',
    email: '',
    assunto: '',
    categoria: 'Geral',
    descricao: '',
    prioridade: 'Normal',
    siteId: '',
    website_url: ''
  })
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [ticketRef, setTicketRef] = useState('')
  const [erroEnvio, setErroEnvio] = useState('')
  const [captcha, setCaptcha] = useState({ n1: 0, n2: 0, result: 0 })
  const [userAnswer, setUserAnswer] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      generateCaptcha()
      setForm({
        nome: cliente?.nome || '',
        email: cliente?.email || '',
        assunto: '',
        categoria: 'Geral',
        descricao: '',
        prioridade: 'Normal',
        siteId: '',
        website_url: ''
      })
    }
  }, [isOpen, cliente])

  const generateCaptcha = () => {
    const n1 = Math.floor(Math.random() * 10) + 1
    const n2 = Math.floor(Math.random() * 10) + 1
    setCaptcha({ n1, n2, result: n1 + n2 })
    setUserAnswer('')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      if (f.size > 5 * 1024 * 1024) {
        alert('Imagem muito grande. Limite: 5MB')
        return
      }
      setFile(f)
      setPreview(URL.createObjectURL(f))
    }
  }

  const enviarTicket = async () => {
    if (!form.assunto || !form.descricao || !userAnswer) return
    if (parseInt(userAnswer) !== captcha.result) {
      setErroEnvio('Resposta de segurança incorrecta.')
      return
    }

    setEnviando(true)
    setErroEnvio('')
    try {
      let anexoUrl = ''
      if (file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const { data: uploadData } = await supabase.storage.from('ticket-attachments').upload(fileName, file)
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('ticket-attachments').getPublicUrl(fileName)
          anexoUrl = publicUrl
        }
      }

      const res = await fetch('/api/submit-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          clienteNome: form.nome,
          clienteEmail: form.email,
          anexoUrl,
          captchaAnswer: userAnswer,
          captchaResult: captcha.result
        })
      })
      const data = await res.json()
      if (data.success) {
        setTicketRef(data.ticketId || '')
        setEnviado(true)
        onTicketCreated()
      } else {
        setErroEnvio(data.error || 'Erro ao enviar ticket.')
        generateCaptcha()
      }
    } catch (err: any) {
      setErroEnvio(err?.message || 'Erro de ligação ao servidor.')
    } finally {
      setEnviando(false)
    }
  }

  const handleClose = () => {
    if (!enviando) {
      onClose()
      setTimeout(() => {
        setEnviado(false)
        setTicketRef('')
        setFile(null)
        setPreview(null)
        setUserAnswer('')
        setErroEnvio('')
      }, 300)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg"><span className="text-red-600 text-xl">🎫</span></div>
            <h2 className="text-lg font-bold text-gray-900">Novo Ticket de Suporte</h2>
          </div>
          <button onClick={handleClose} disabled={enviando} className="p-2 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {enviado ? (
            <div className="text-center space-y-4 py-8">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-3xl">✅</div>
              <h3 className="text-xl font-bold text-gray-900">Ticket Enviado com Sucesso!</h3>
              {ticketRef && <p className="text-gray-600">A sua referência é: <span className="font-mono font-bold bg-gray-100 px-2 py-1 rounded text-red-600">{ticketRef}</span></p>}
              <p className="text-sm text-gray-500 max-w-sm mx-auto">Receberá uma confirmação no seu email em instantes. A nossa equipa irá analisar o seu pedido.</p>
              <div className="pt-4">
                <button onClick={handleClose} className="px-6 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-bold hover:bg-gray-900 transition-all shadow-sm">Fechar</button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">O Teu Nome</label>
                  <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Teu Endereço de Email</label>
                  <input value={form.email} readOnly className="w-full px-4 py-2.5 border border-gray-100 bg-gray-50 text-gray-400 rounded-lg text-sm cursor-not-allowed" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Assunto do Pedido</label>
                  <input value={form.assunto} onChange={e => setForm({ ...form, assunto: e.target.value })} placeholder="Ex: Não consigo aceder ao meu email" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Categoria</label>
                  <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white">
                    {['Geral', 'Técnico', 'Facturação', 'Domínio', 'Email', 'SSL', 'Backup'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Serviço Relacionado</label>
                  <select value={form.siteId} onChange={e => setForm({ ...form, siteId: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white">
                    <option value="">Nenhum / Geral</option>
                    {sites?.map((s: any) => <option key={s.id || s.domain || Math.random().toString()} value={s.id || s.domain}>{s.domain}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Prioridade</label>
                  <div className="flex gap-2 h-[42px] items-center">
                    {['Baixa', 'Normal', 'Alta', 'Urgente'].map(p => (
                      <button key={p} onClick={() => setForm({ ...form, prioridade: p })} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all border ${form.prioridade === p ? 'bg-red-600 text-white border-red-600' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'}`}>{p}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">Descrição Detalhada</label>
                <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Por favor, descreva o problema com o máximo detalhe possível..." rows={4} className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-end">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase block">Anexar Imagem (Opcional)</label>
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-bold border border-gray-200 transition-all border-dashed">
                      <span>📸</span> {file ? 'Alterar Imagem' : 'Escolher Ficheiro'}
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                    {preview && (
                      <div className="relative w-12 h-12 border rounded-lg overflow-hidden group">
                        <img src={preview} alt="preview" className="w-full h-full object-cover" />
                        <button onClick={() => { setFile(null); setPreview(null); }} className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase block text-right">Verificação de Segurança</label>
                  <div className="flex items-center justify-end gap-3">
                    <span className="text-sm font-bold text-gray-600 italic">Quanto é {captcha.n1} + {captcha.n2}?</span>
                    <input type="number" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} placeholder="?" className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
                  </div>
                </div>
              </div>
              <input type="text" name="website_url" value={form.website_url} onChange={e => setForm({ ...form, website_url: e.target.value })} className="hidden" tabIndex={-1} />
            </div>
          )}
        </div>
        {!enviado && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
            <div className="text-[11px] text-gray-400">
              <p>🔹 Tempo de resposta médio: 2 horas</p>
              <p>🔹 Responderemos para {form.email}</p>
            </div>
            <div className="flex items-center gap-3">
              {erroEnvio && <p className="text-xs text-red-600 font-bold bg-red-50 border border-red-200 rounded px-3 py-2">{erroEnvio}</p>}
              <button onClick={handleClose} disabled={enviando} className="px-4 py-2.5 text-gray-600 hover:text-gray-800 text-sm font-bold transition-colors">Cancelar</button>
              <button onClick={enviarTicket} disabled={!form.assunto || !form.descricao || !userAnswer || enviando} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-red-200 flex items-center gap-2">
                {enviando ? <>⏳ <span className="animate-pulse">A Enviar...</span></> : <>🚀 Enviar Ticket</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
