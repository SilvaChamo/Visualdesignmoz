'use client'


import { ArrowRight, Play, CheckCircle, Phone, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function Banner() {
  return (
    <section className="relative h-[800px] overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src="https://via.placeholder.com/1920x800/1a1a1a/ffffff?text=Visual+Design+Banner"
          alt="Visual Design Banner"
          className="w-full h-full object-cover"
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex items-center justify-center">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl text-center">
            <div
            >
              {/* Badge */}
              <div
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-full text-sm font-medium mb-6"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Agência de Design Premiada em Maputo
              </div>

              {/* Main Title */}
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6"
              >
                Transformamos suas
                <br />
                Ideias em Realidade
                <br />
                Digital
              </h1>

              {/* Description */}
              <p
                className="text-xl text-gray-200 mb-8"
              >
                Criamos experiências digitais excepcionais que impulsionam seu negócio. 
                Web design, desenvolvimento e marketing digital que geram resultados.
              </p>

              {/* CTA Buttons */}
              <div
                className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
              >
                <Button size="lg" className="group" asChild>
                  <Link href="/contacto">
                    Orçamento Gratuito
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="group border-white text-white hover:bg-white hover:text-black">
                  <Play className="mr-2 w-4 h-4" />
                  Ver Portfolio
                </Button>
              </div>

              {/* Contact Info */}
              <div
                className="flex flex-col sm:flex-row gap-4 justify-center text-gray-300"
              >
                <a href="tel:+258821234567" className="flex items-center space-x-2 hover:text-white transition-colors">
                  <Phone className="w-4 h-4" />
                  <span>+258 821 234 567</span>
                </a>
                <a href="mailto:info@visualdesign.co.mz" className="flex items-center space-x-2 hover:text-white transition-colors">
                  <Mail className="w-4 h-4" />
                  <span>info@visualdesign.co.mz</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bolas Saltitando - Animações */}
      <div
        className="absolute top-20 right-10 w-20 h-20 bg-red-600/20 rounded-full backdrop-blur-sm"
      />
      <div
        className="absolute bottom-20 right-32 w-16 h-16 bg-red-600/20 rounded-full backdrop-blur-sm"
      />
      <div
        className="absolute top-1/2 -left-8 w-12 h-12 bg-red-600/20 rounded-full backdrop-blur-sm"
      />
      <div
        className="absolute top-32 left-20 w-8 h-8 bg-red-600/30 rounded-full"
      />
      <div
        className="absolute bottom-32 left-40 w-6 h-6 bg-red-600/25 rounded-full"
      />
    </section>
  )
}
