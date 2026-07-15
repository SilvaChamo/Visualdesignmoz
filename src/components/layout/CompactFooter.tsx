'use client'

import Link from 'next/link'

export function CompactFooter() {
  return (
    <footer className="bg-black dark:bg-zinc-900 text-white py-[34px]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <p className="text-xs text-slate-500">
          &copy; {new Date().getFullYear()} VisualDesign. Todos os direitos reservados.
        </p>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400">
          <Link href="/servicos" className="hover:text-white transition-colors">Serviços</Link>
          <Link href="/precos/hospedagem" className="hover:text-white transition-colors">Hospedagem</Link>
          <Link href="/precos/dominios" className="hover:text-white transition-colors">Domínios</Link>
          <Link href="/portfolio" className="hover:text-white transition-colors">Portfólio</Link>
          <Link href="/contacto" className="hover:text-white transition-colors">Contacto</Link>
        </nav>
      </div>
    </footer>
  )
}
