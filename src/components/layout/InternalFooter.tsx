'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n'

export function InternalFooter() {
  const { t } = useI18n()

  return (
    <footer className="bg-slate-900 text-white py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center md:text-left">
          {/* Coluna 1: Sobre Nós e Relacionados */}
          <div className="flex flex-col space-y-4 items-center md:items-start">
            <h3 className="text-red-500 font-bold uppercase text-sm tracking-wider">Sobre a Empresa</h3>
            <ul className="space-y-2 text-slate-400 text-sm">
              <li>
                <Link href="/sobre-nos" className="hover:text-white transition-colors">Sobre Nós</Link>
              </li>
              <li>
                <Link href="/portfolio" className="hover:text-white transition-colors">Portfólio</Link>
              </li>
              <li>
                <Link href="/contacto" className="hover:text-white transition-colors">Contactos</Link>
              </li>
              <li>
                <Link href="/sobre-nos" className="hover:text-white transition-colors">A nossa Equipa</Link>
              </li>
            </ul>
          </div>

          {/* Coluna 2: Serviços e Cursos */}
          <div className="flex flex-col space-y-4 items-center md:items-start">
            <h3 className="text-red-500 font-bold uppercase text-sm tracking-wider">O que Fazemos</h3>
            <ul className="space-y-2 text-slate-400 text-sm">
              <li>
                <Link href="/servicos" className="hover:text-white transition-colors">Serviços</Link>
              </li>
              <li>
                <Link href="/cursos" className="hover:text-white transition-colors">Cursos</Link>
              </li>
              <li>
                <Link href="/servicos/dominios" className="hover:text-white transition-colors">Domínios</Link>
              </li>
              <li>
                <Link href="/servicos/hospedagem" className="hover:text-white transition-colors">Hospedagem</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-10 pt-6 text-center text-slate-500 text-xs">
          <p>&copy; {new Date().getFullYear()} VisualDesign. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
