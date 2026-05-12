'use client'

import { ContactFormComponent } from '@/components/forms/ContactForm'
import { useI18n } from '@/lib/i18n'
import { Phone, Mail, MapPin } from 'lucide-react'

export default function ContactPage() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Hero Section Standardized */}
      <div className="bg-[#404040] relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">{t('contact.page.title')}</h1>
            <p className="text-base text-white font-normal max-w-2xl mx-auto">
              {t('contact.page.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Contact Content */}
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Contact Info Cards */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center flex flex-col items-center">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600 mb-4">
                <Phone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{t('contact.page.phone')}</h3>
              <p className="text-slate-600 text-sm">+258 821 234 567</p>
              <p className="text-slate-600 text-sm">+258 841 234 567</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center flex flex-col items-center">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600 mb-4">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{t('contact.page.email')}</h3>
              <p className="text-slate-600 text-sm">info@visualdesign.co.mz</p>
              <p className="text-slate-600 text-sm">suporte@visualdesign.co.mz</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center flex flex-col items-center">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600 mb-4">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{t('contact.page.location')}</h3>
              <p className="text-slate-600 text-sm">{t('contact.page.locationValue')}</p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="mt-12 max-w-3xl mx-auto bg-white p-8 lg:p-10 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
              {t('contact.page.formTitle')}
            </h2>
            <p className="text-slate-500 text-sm text-center mb-8">
              Preencha o formulário abaixo e entraremos em contacto o mais breve possível.
            </p>
            <ContactFormComponent />
          </div>
        </div>
      </div>
    </div>
  )
}
