'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { contactService, ContactForm } from '@/lib/services/contact'
import { useI18n } from '@/lib/i18n'
import { SERVICE_BRANDS } from '@/lib/services-catalog'

interface ContactFormProps {
  hideServiceSelect?: boolean
}

function ContactFormInner({ hideServiceSelect = false }: ContactFormProps) {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const serviceParam = searchParams.get('servico') || ''

  const [formData, setFormData] = useState<ContactForm>({
    name: '',
    email: '',
    phone: '',
    message: '',
    service: ''
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (serviceParam && !hideServiceSelect) {
      setFormData(prev => ({ ...prev, service: serviceParam }))
    }
  }, [serviceParam, hideServiceSelect])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await contactService.submitContactForm(formData)
    
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setFormData({
        name: '',
        email: '',
        phone: '',
        message: '',
        service: ''
      })
    }
    
    setLoading(false)
  }

  if (success) {
    return (
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
        <div className="text-green-600 dark:text-green-400 text-lg font-medium mb-2">
          {t('contact.success') || 'Mensagem enviada com sucesso!'}
        </div>
        <div className="text-green-700 dark:text-green-300">
          {t('contact.successMessage') || 'Entraremos em contato em breve.'}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {t('contact.name') || 'Nome'} *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {t('contact.email') || 'Email'} *
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {t('contact.phone') || 'Telefone'}
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {!hideServiceSelect && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {t('contact.service') || 'Serviço de Interesse'}
          </label>
          <select
            value={formData.service}
            onChange={(e) => setFormData({ ...formData, service: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="">{t('contact.selectService') || 'Selecione um serviço'}</option>
            {SERVICE_BRANDS.map((brand) => (
              <optgroup key={brand.slug} label={brand.name} className="font-bold text-zinc-700 dark:text-zinc-300">
                {brand.services.map((service) => (
                  <option key={service.slug} value={service.slug} className="font-normal">
                    {service.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {t('contact.message') || 'Mensagem'} *
        </label>
        <textarea
          required
          rows={4}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-auto px-8 bg-red-600 hover:bg-red-700 text-white font-bold transition-colors cursor-pointer"
      >
        {loading ? (t('contact.sending') || 'Enviando...') : (t('contact.send') || 'Enviar Mensagem')}
      </Button>
    </form>
  )
}

export function ContactFormComponent({ hideServiceSelect = false }: ContactFormProps) {
  return (
    <Suspense fallback={<div className="text-zinc-500 text-sm">A carregar formulário...</div>}>
      <ContactFormInner hideServiceSelect={hideServiceSelect} />
    </Suspense>
  )
}
