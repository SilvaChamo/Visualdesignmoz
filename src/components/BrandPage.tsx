'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SERVICE_BRANDS, type ServiceBrand } from '@/lib/services-catalog'

// Classes estáticas (não computadas) para o Tailwind conseguir incluí-las no build.
const ACCENT: Record<string, { chip: string; icon: string; button: string }> = {
  blue: { chip: 'bg-blue-50 text-blue-600', icon: 'text-blue-600', button: 'hover:bg-blue-600' },
  red: { chip: 'bg-red-50 text-red-600', icon: 'text-red-600', button: 'hover:bg-red-600' },
  amber: { chip: 'bg-amber-50 text-amber-600', icon: 'text-amber-600', button: 'hover:bg-amber-600' },
  slate: { chip: 'bg-slate-100 text-slate-700', icon: 'text-slate-700', button: 'hover:bg-slate-700' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600', icon: 'text-emerald-600', button: 'hover:bg-emerald-600' },
}

export function BrandPage({ brand }: { brand: ServiceBrand }) {
  const accent = ACCENT[brand.color] || ACCENT.slate

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-[#404040] relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[280px] relative z-10">
          <div className="text-center">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-3 ${accent.chip}`}>
              Uma marca VisualDesign
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{brand.name}</h1>
            <p className="text-base text-white/90 font-normal max-w-2xl mx-auto">{brand.tagline}</p>
          </div>
        </div>
      </div>

      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {brand.services.map((service) => (
              <Link
                key={service.slug}
                href={service.href}
                className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group"
              >
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{service.title}</h3>
                  <p className="text-slate-600 text-sm mb-6 leading-relaxed">{service.desc}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${accent.icon}`}>
                  Ver serviço <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-16 flex flex-wrap items-center justify-center gap-3">
            {SERVICE_BRANDS.filter((b) => b.slug !== brand.slug).map((other) => (
              <Link
                key={other.slug}
                href={`/${other.slug}`}
                className="px-4 py-2 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors"
              >
                {other.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
