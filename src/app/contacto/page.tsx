'use client'

import { ContactFormComponent } from '@/components/forms/ContactForm'
import { useI18n } from '@/lib/i18n'
import { Phone, Mail, MapPin } from 'lucide-react'

export default function ContactPage() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-foreground">
      {/* Hero Section Standardized */}
      <div className="bg-[#09090b] relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">{t('contact.page.title')}</h1>
            <p className="text-base text-zinc-300 font-normal max-w-2xl mx-auto">
              {t('contact.page.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Contact Content */}
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left Column: Contact Info Cards (Stacked) */}
            <div className="lg:col-span-1 space-y-6">
              
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200/80 dark:border-zinc-800 flex items-center gap-4">
                <div className="w-12 h-12 bg-red-50 dark:bg-red-950/20 rounded-full flex items-center justify-center text-red-600 flex-shrink-0">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">{t('contact.page.phone')}</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm">+258 825 288 318</p>
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm">+258 841 234 567</p>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200/80 dark:border-zinc-800 flex items-center gap-4">
                <div className="w-12 h-12 bg-red-50 dark:bg-red-950/20 rounded-full flex items-center justify-center text-red-600 flex-shrink-0">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">{t('contact.page.email')}</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm">info@visualdesignmoz.com</p>
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm">suporte@visualdesignmoz.com</p>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200/80 dark:border-zinc-800 flex items-center gap-4">
                <div className="w-12 h-12 bg-red-50 dark:bg-red-950/20 rounded-full flex items-center justify-center text-red-600 flex-shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">{t('contact.page.location')}</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm">{t('contact.page.locationValue')}</p>
                </div>
              </div>

            </div>

            {/* Right Column: Contact Form */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-8 lg:p-10 rounded-2xl shadow-sm border border-zinc-200/80 dark:border-zinc-800">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                {t('contact.page.formTitle')}
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8">
                Preencha o formulário abaixo e entraremos em contacto o mais breve possível.
              </p>
              <ContactFormComponent />
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
