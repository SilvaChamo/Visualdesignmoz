'use client'

import React, { useState, useEffect } from 'react'
import { X, Check, Loader2 } from 'lucide-react'
import { contactService } from '@/lib/services/contact'

export interface BudgetRequestModalProps {
  isOpen: boolean
  onClose: () => void
  initialService?: string
}

interface ServiceCategory {
  slug: string
  label: string
  subServices: string[]
}

const SERVICES_MAP: ServiceCategory[] = [
  {
    slug: 'webdesign',
    label: 'Web Design / Desenvolvimento',
    subServices: ['Website Institucional', 'Loja Online (E-commerce)', 'Landing Page de Conversão', 'Portal Web Customizado']
  },
  {
    slug: 'seo',
    label: 'SEO & Otimização',
    subServices: ['SEO On-page e Otimização', 'Auditoria Técnica e Monitoria', 'Criação de Conteúdo Otimizado', 'Estratégia de Backlinks']
  },
  {
    slug: 'design-grafico',
    label: 'Design Gráfico',
    subServices: ['Logótipo e Identidade Visual', 'Design Editorial (Catálogos, Brochuras)', 'Design Publicitário (Banners, Outdoors)', 'Stationary (Cartões, Envelopes)']
  },
  {
    slug: 'hospedagem',
    label: 'Hospedagem Web',
    subServices: ['Hospedagem Partilhada', 'Servidor VPS Dedicado', 'Cloud Hosting Escalável', 'Alojamento Otimizado WordPress']
  },
  {
    slug: 'email',
    label: 'Email Profissional',
    subServices: ['Email com Domínio Próprio', 'Licenciamento Microsoft 365', 'Licenciamento Google Workspace', 'Configuração de DNS & Segurança']
  },
  {
    slug: 'ssl',
    label: 'Certificados SSL',
    subServices: ['SSL DV (Domain Validation)', 'SSL OV (Organization Validation)', 'SSL EV (Extended Validation)', 'Wildcard / Multi-Domain SSL']
  },
  {
    slug: 'suporte',
    label: 'Suporte Técnico',
    subServices: ['Manutenção Preventiva de Sites', 'Monitoramento de Uptime 24/7', 'Consultoria e Auditoria de TI', 'Contratos de Suporte SLA']
  },
  {
    slug: 'feiras-eventos',
    label: 'Feiras e Eventos',
    subServices: ['Stands e Montagem 3D', 'Aluguer de Equipamento de Som e Luz', 'Sinalética e Cenografia de Evento', 'Cobertura Fotográfica e Vídeo']
  },
  {
    slug: 'catering',
    label: 'Catering & Eventos',
    subServices: ['Coffee Break Empresarial', 'Brunch e Cocktails Volantes', 'Banquetes e Jantares de Gala', 'Menus Temáticos Customizados']
  },
  {
    slug: 'branding',
    label: 'Branding & Estratégia',
    subServices: ['Criação de Logo e Naming', 'Posicionamento e Brand Voice', 'Auditoria e Rebranding de Marca', 'Guidelines e Brandbook Completo']
  },
  {
    slug: 'fotografia',
    label: 'Fotografia Profissional',
    subServices: ['Cobertura de Eventos Sociais', 'Retratos Corporativos (Headshots)', 'Fotografia Editorial / Publicitária', 'Fotografia Industrial e de Produto']
  }
]

export function BudgetRequestModal({ isOpen, onClose, initialService }: BudgetRequestModalProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Form states
  const [company, setCompany] = useState('')
  const [nif, setNif] = useState('')
  const [service, setService] = useState('webdesign')
  const [responsible, setResponsible] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [contactPref, setContactPref] = useState('E-mail')
  const [preferredTime, setPreferredTime] = useState('')
  const [subject, setSubject] = useState('')
  const [details, setDetails] = useState('')
  const [selectedSubServices, setSelectedSubServices] = useState<string[]>([])

  // Set initial service
  useEffect(() => {
    if (initialService) {
      const match = SERVICES_MAP.find(s => s.slug === initialService || s.slug.replace('-', '') === initialService.replace('-', ''))
      if (match) {
        setService(match.slug)
      } else {
        setService(initialService)
      }
    }
  }, [initialService, isOpen])

  // Update selected sub-services and subject when service changes
  useEffect(() => {
    const currentCat = SERVICES_MAP.find(s => s.slug === service)
    setSubject(`Solicitação de Orçamento — ${currentCat?.label || service}`)
    setSelectedSubServices([]) // Reset sub-services when main service changes
  }, [service])

  // Toggle sub-service selection
  const handleToggleSubService = (subService: string) => {
    setSelectedSubServices(prev =>
      prev.includes(subService)
        ? prev.filter(s => s !== subService)
        : [...prev, subService]
    )
  }

  // Close modal with animation delays if needed
  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    // Formatar a mensagem detalhada como pedido pelo utilizador
    const formattedMessage = `[SOLICITAÇÃO DE ORÇAMENTO]

Instituição / Empresa: ${company || 'Não especificada'}
NIF / NUEL: ${nif || 'Não especificado'}
Responsável: ${responsible}
Cargo / Função: ${role || 'Não especificado'}
Contacto Preferencial: ${contactPref}
Horário Preferencial: ${preferredTime || 'Qualquer horário'}

Sub-serviços Selecionados:
${selectedSubServices.length > 0 ? selectedSubServices.map(s => `- ${s}`).join('\n') : '- Nenhum sub-serviço selecionado'}

Detalhes da Solicitação:
${details}`

    try {
      const { error } = await contactService.submitContactForm({
        name: responsible,
        email: email,
        phone: phone,
        message: formattedMessage,
        service: service
      })

      if (error) {
        throw new Error(error.message || 'Erro ao submeter orçamento.')
      }

      setSuccess(true)
      // Reset form fields
      setCompany('')
      setNif('')
      setResponsible('')
      setRole('')
      setEmail('')
      setPhone('')
      setPreferredTime('')
      setDetails('')
      setSelectedSubServices([])
    } catch (err: any) {
      console.error('[BudgetRequestSubmit]', err)
      setErrorMsg(err.message || 'Ocorreu um erro ao submeter o formulário. Por favor tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const currentCategoryObj = SERVICES_MAP.find(s => s.slug === service)
  const currentSubServices = currentCategoryObj?.subServices || []

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Background overlay */}
      <div 
        className="absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-5xl bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden max-h-[90vh] flex flex-col transition-all duration-300 scale-100">
        
        {/* Header */}
        <div className="px-8 pt-8 pb-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0 flex items-start justify-between">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              Solicitar este serviço
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed font-sans">
              Preencha os dados da sua instituição. A sua solicitação será recebida pela nossa equipa, para que possamos entrar em contacto consigo, confirmar o pedido e dar seguimento ao serviço solicitado.
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-100 hover:bg-red-500 hover:text-white dark:bg-zinc-800 dark:hover:bg-red-600 transition-colors text-zinc-500 dark:text-zinc-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center shadow-inner">
              <Check className="w-10 h-10 stroke-[3px]" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Solicitação Enviada!</h3>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-md text-sm">
              Obrigado pelo seu pedido de orçamento. A nossa equipa irá analisar os seus dados e entrará em contacto muito em breve.
            </p>
            <button 
              type="button"
              onClick={() => { setSuccess(false); onClose(); }}
              className="mt-4 px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all"
            >
              Fechar Janela
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col md:grid md:grid-cols-2 gap-8 p-8 scrollbar-thin">
            
            {/* Left Panel: Client details */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 tracking-wider uppercase border-b border-zinc-100 dark:border-zinc-800 pb-2">
                Dados do Solicitante / Empresa
              </h3>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-zinc-500 dark:text-zinc-400 mb-1 tracking-wider">
                  Instituição / Empresa *
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Nome da instituição ou empresa"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-sm text-zinc-900 dark:text-white font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-zinc-500 dark:text-zinc-400 mb-1 tracking-wider">
                    NIF / NUEL
                  </label>
                  <input 
                    type="text" 
                    placeholder="Identificação fiscal"
                    value={nif}
                    onChange={e => setNif(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-sm text-zinc-900 dark:text-white font-sans"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-zinc-500 dark:text-zinc-400 mb-1 tracking-wider">
                    Categoria Geral *
                  </label>
                  <select
                    value={service}
                    onChange={e => setService(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-sm text-zinc-900 dark:text-white font-sans cursor-pointer"
                  >
                    {SERVICES_MAP.map(cat => (
                      <option key={cat.slug} value={cat.slug}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-zinc-500 dark:text-zinc-400 mb-1 tracking-wider">
                    Responsável *
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="Nome completo"
                    value={responsible}
                    onChange={e => setResponsible(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-sm text-zinc-900 dark:text-white font-sans"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-zinc-500 dark:text-zinc-400 mb-1 tracking-wider">
                    Cargo / Função
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ex: Diretor de Comunicação"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-sm text-zinc-900 dark:text-white font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-zinc-500 dark:text-zinc-400 mb-1 tracking-wider">
                    Email Institucional *
                  </label>
                  <input 
                    type="email" 
                    required
                    placeholder="contacto@empresa.co.mz"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-sm text-zinc-900 dark:text-white font-sans"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-zinc-500 dark:text-zinc-400 mb-1 tracking-wider">
                    Telefone / WhatsApp *
                  </label>
                  <input 
                    type="tel" 
                    required
                    placeholder="+258 84 000 0000"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-sm text-zinc-900 dark:text-white font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-zinc-500 dark:text-zinc-400 mb-1 tracking-wider">
                    Preferência de Contacto
                  </label>
                  <select 
                    value={contactPref}
                    onChange={e => setContactPref(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-sm text-zinc-900 dark:text-white font-sans cursor-pointer"
                  >
                    <option value="E-mail">E-mail</option>
                    <option value="Telefone">Telefone</option>
                    <option value="WhatsApp">WhatsApp</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-zinc-500 dark:text-zinc-400 mb-1 tracking-wider">
                    Horário Preferencial
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ex: Manhã, 09h-12h"
                    value={preferredTime}
                    onChange={e => setPreferredTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-sm text-zinc-900 dark:text-white font-sans"
                  />
                </div>
              </div>
            </div>

            {/* Right Panel: Service checklist & details */}
            <div className="space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 tracking-wider uppercase border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  Escolha de Sub-serviços
                </h3>

                {/* Sub-services selection checkboxes */}
                <div className="mt-3">
                  <label className="block text-[10px] font-extrabold uppercase text-zinc-500 dark:text-zinc-400 mb-2 tracking-wider">
                    Selecione as opções pretendidas (Múltipla Seleção)
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-2 scrollbar-thin">
                    {currentSubServices.map((sub, idx) => {
                      const isSelected = selectedSubServices.includes(sub)
                      return (
                        <div 
                          key={idx}
                          onClick={() => handleToggleSubService(sub)}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all duration-200 ${
                            isSelected 
                              ? 'border-red-500 bg-red-50/40 dark:bg-red-950/10 text-red-600 dark:text-red-400' 
                              : 'border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 hover:bg-zinc-100/50 dark:hover:bg-zinc-900'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                            isSelected 
                              ? 'bg-red-500 border-red-500 text-white' 
                              : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3px]" />}
                          </div>
                          <span className="text-xs font-semibold leading-tight">{sub}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-[10px] font-extrabold uppercase text-zinc-500 dark:text-zinc-400 mb-1 tracking-wider">
                    Assunto *
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="Assunto da solicitação"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-sm text-zinc-900 dark:text-white font-sans"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-[10px] font-extrabold uppercase text-zinc-500 dark:text-zinc-400 mb-1 tracking-wider">
                    Detalhes da Solicitação *
                  </label>
                  <textarea 
                    required
                    rows={3}
                    placeholder="Descreva o projeto, prazos, objetivos e qualquer informação relevante."
                    value={details}
                    onChange={e => setDetails(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-sm text-zinc-900 dark:text-white font-sans resize-none scrollbar-thin"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 flex gap-4 shrink-0 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold transition-all text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-zinc-300 text-white font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/10 text-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>A enviar...</span>
                    </>
                  ) : (
                    <span>Enviar solicitação</span>
                  )}
                </button>
              </div>

            </div>
          </form>
        )}

      </div>
    </div>
  )
}
