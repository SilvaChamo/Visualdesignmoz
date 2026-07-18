'use client'

import Link from 'next/link'
import { SERVICE_BRANDS } from '@/lib/services-catalog'

export function CompactFooter() {
  return (
    <footer className="bg-zinc-950 dark:bg-[#FFFFFF1A] text-white border-t border-white/5 relative z-10">
      {/* 5 Columns Menu Area (Max-Width Container) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-[60px]">
        <div className="mx-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-8 gap-y-5 lg:gap-8">

            {/* Coluna 1: Logo & Contactos */}
            <div className="flex flex-col space-y-1">
              <Link href="/" className="inline-block">
                <img
                  src="/assets/Logo - Branco.png"
                  alt="VisualDesign Logo"
                  className="h-14 w-auto object-contain"
                />
              </Link>
              <div className="flex flex-col space-y-2 text-sm text-zinc-400 pt-1">
                <div className="flex flex-col space-y-1">
                  <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Telefone / Suporte</span>
                  <a href="tel:+258825288318" className="text-zinc-300 hover:text-white transition-colors">
                    +258 82 52 88 318
                  </a>
                  <a href="tel:+258841234567" className="text-zinc-300 hover:text-white transition-colors">
                    +258 84 123 4567
                  </a>
                </div>
                <div className="flex flex-col space-y-1">
                  <a href="mailto:info@visualdesign.co.mz" className="text-zinc-300 hover:text-white transition-colors">
                    info@visualdesign.co.mz
                  </a>
                  <a href="mailto:suporte@visualdesign.co.mz" className="text-zinc-300 hover:text-white transition-colors">
                    suporte@visualdesign.co.mz
                  </a>
                </div>
              </div>
            </div>

            {/* Coluna 2: Serviços Criativos (marcas) */}
            <div className="flex flex-col space-y-4 lg:pl-[30px]">
              <h4 className="text-base font-extrabold text-zinc-200">
                Serviços Criativos
              </h4>
              <nav className="flex flex-col space-y-2.5 text-sm text-zinc-400">
                {SERVICE_BRANDS.map((brand) => (
                  <Link
                    key={brand.slug}
                    href={`/${brand.slug}`}
                    className="hover:text-white hover:translate-x-1.5 transition-all duration-300 inline-block"
                  >
                    {brand.name}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Coluna 3: Domínios */}
            <div className="flex flex-col space-y-4 lg:pl-[30px]">
              <h4 className="text-base font-extrabold text-zinc-200">
                Domínios
              </h4>
              <nav className="flex flex-col space-y-2.5 text-sm text-zinc-400">
                <Link href="/servicos/dominios" className="hover:text-white hover:translate-x-1.5 transition-all duration-300 inline-block">Registo de Domínios</Link>
                <Link href="/servicos/transferencia" className="hover:text-white hover:translate-x-1.5 transition-all duration-300 inline-block">Transferir Domínio</Link>
                <Link href="/servicos/dominios" className="hover:text-white hover:translate-x-1.5 transition-all duration-300 inline-block">Renovar Domínio</Link>
                <Link href="/servicos/dominios" className="hover:text-white hover:translate-x-1.5 transition-all duration-300 inline-block">Domínios .mz</Link>
                <Link href="/servicos/dominios" className="hover:text-white hover:translate-x-1.5 transition-all duration-300 inline-block">Pesquisa WHOIS</Link>
              </nav>
            </div>

            {/* Coluna 4: Hospedagem */}
            <div className="flex flex-col space-y-4 lg:pl-[30px]">
              <h4 className="text-base font-extrabold text-zinc-200">
                Hospedagem
              </h4>
              <nav className="flex flex-col space-y-2.5 text-sm text-zinc-400">
                <Link href="/servicos/hospedagem" className="hover:text-white hover:translate-x-1.5 transition-all duration-300 inline-block">Alojamento Web</Link>
                <Link href="/servicos/hospedagem" className="hover:text-white hover:translate-x-1.5 transition-all duration-300 inline-block">Revenda de Hospedagem</Link>
                <Link href="/servicos/email" className="hover:text-white hover:translate-x-1.5 transition-all duration-300 inline-block">E-mail Profissional</Link>
                <Link href="/servicos/ssl" className="hover:text-white hover:translate-x-1.5 transition-all duration-300 inline-block">Certificados SSL</Link>
                <Link href="/servicos/servidor" className="hover:text-white hover:translate-x-1.5 transition-all duration-300 inline-block">Servidores VPS</Link>
              </nav>
            </div>

            {/* Coluna 5: Links Úteis */}
            <div className="flex flex-col space-y-4 lg:pl-[30px]">
              <h4 className="text-base font-extrabold text-zinc-200">
                Links Úteis
              </h4>
              <nav className="flex flex-col space-y-2.5 text-sm text-zinc-400">
                <Link href="/sobre-nos" className="hover:text-white hover:translate-x-1.5 transition-all duration-300 inline-block">Sobre Nós</Link>
                <Link href="/portfolio" className="hover:text-white hover:translate-x-1.5 transition-all duration-300 inline-block">Portfólio</Link>
                <Link href="/cursos" className="hover:text-white hover:translate-x-1.5 transition-all duration-300 inline-block">Base de Conhecimentos</Link>
                <Link href="/servicos/suporte" className="hover:text-white hover:translate-x-1.5 transition-all duration-300 inline-block">Suporte & FAQ</Link>
                <Link href="/contacto" className="hover:text-white hover:translate-x-1.5 transition-all duration-300 inline-block">Contactos</Link>
              </nav>
            </div>

          </div>
        </div>
      </div>

      {/* Internal Separator Line (Not full screen width) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mx-5 border-t border-white/10 my-6"></div>
      </div>

      {/* Row for Payments and Social Media (Same background as footer content) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        <div className="mx-5 flex flex-col md:flex-row items-center justify-between gap-6">

          {/* Lado Esquerdo: Redes Sociais */}
          <div className="flex items-center gap-5">
            <a href="https://wa.me/258841234567" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-green-500 transition-colors" title="WhatsApp">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.5-5.729-1.448L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.588 2.015 14.113.99 11.516.99c-5.44 0-9.866 4.372-9.87 9.802 0 1.714.452 3.39 1.312 4.869l-1.01 3.693 3.818-1.006zm11.03-5.309c-.273-.137-1.616-.797-1.866-.889-.25-.092-.432-.137-.613.137-.182.273-.706.889-.865 1.072-.158.182-.318.204-.592.068-.274-.136-1.156-.427-2.202-1.359-.815-.728-1.365-1.626-1.526-1.898-.16-.272-.017-.418.12-.554.123-.122.274-.32.411-.479.137-.16.183-.273.273-.456.09-.183.046-.342-.023-.479-.069-.137-.613-1.477-.84-2.023-.222-.534-.467-.461-.643-.47l-.549-.009c-.19 0-.501.071-.762.355-.262.284-1.001.977-1.001 2.384 0 1.407 1.024 2.77 1.168 2.964.144.193 2.017 3.081 4.885 4.318.682.294 1.214.47 1.63.604.686.218 1.31.187 1.8.114.548-.081 1.616-.66 1.843-1.298.228-.639.228-1.186.16-1.298-.069-.113-.25-.183-.524-.32z" />
              </svg>
            </a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-blue-600 transition-colors" title="Facebook">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-pink-500 transition-colors" title="Instagram">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C8.74 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.74 0 12s.014 3.667.072 4.947c.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072s3.667-.014 4.947-.072c4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.26-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.26 0 12 0zm0 2.927c3.19 0 3.567.012 4.83.07 3.033.138 4.385 1.506 4.524 4.524.056 1.262.068 1.637.068 4.829 0 3.19-.012 3.567-.068 4.83-.137 3.02-1.499 4.384-4.524 4.523-1.262.057-1.636.07-4.83.07-3.19 0-3.567-.013-4.829-.07-3.037-.14-4.385-1.506-4.524-4.523-.057-1.263-.07-1.638-.07-4.83 0-3.19.013-3.567.07-4.829.139-3.033 1.503-4.385 4.524-4.524 1.262-.057 1.637-.07 4.829-.07zm0 2.905c-3.393 0-6.14 2.748-6.14 6.14 0 3.393 2.747 6.14 6.14 6.14 3.393 0 6.14-2.747 6.14-6.14 0-3.392-2.747-6.14-6.14-6.14zm0 10.053c-2.162 0-3.913-1.75-3.913-3.913 0-2.162 1.751-3.913 3.913-3.913 2.163 0 3.913 1.751 3.913 3.913 0 2.162-1.75 3.913-3.913 3.913zm6.374-10.264c0 .779-.63 1.409-1.409 1.409-.779 0-1.409-.63-1.409-1.409 0-.779.63-1.409 1.409-1.409.779 0 1.409.63 1.409 1.409z" />
              </svg>
            </a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-red-600 transition-colors" title="YouTube">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M23.498 6.163a3.003 3.003 0 00-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.507a3.003 3.003 0 00-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 002.11 2.11c1.87.507 9.388.507 9.388.507s7.518 0 9.388-.507a3.003 3.003 0 002.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-sky-400 transition-colors" title="Twitter / X">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>

          {/* Lado Direito: Checkout Seguro e Logos de Pagamento */}
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-4">
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold mr-2">
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <span>Checkout Seguro</span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* M-Pesa */}
              <img src="/assets/m-pesas.png" alt="M-Pesa" className="h-6 w-auto object-contain rounded-none" />
              {/* E-Mola */}
              <img src="/assets/E-MOLA.png" alt="E-Mola" className="h-6 w-auto object-contain rounded-none" />
              {/* Visa */}
              <img src="/assets/visa.jpg" alt="Visa" className="h-6 w-auto object-contain rounded-none" />
              {/* Mastercard SVG */}
              <div className="h-6 w-9 bg-zinc-900 border border-white/5 rounded-none flex items-center justify-center p-1">
                <svg className="h-4 w-auto" viewBox="0 0 24 16">
                  <circle cx="8" cy="8" r="8" fill="#EB001B" />
                  <circle cx="16" cy="8" r="8" fill="#F79E1B" fillOpacity="0.8" />
                </svg>
              </div>
              {/* PayPal */}
              <img src="/assets/paypal.svg" alt="PayPal" className="h-6 w-auto object-contain rounded-none bg-white px-1 py-0.5" />
            </div>
          </div>

        </div>
      </div>

      {/* 100% Width Divider Line */}
      <div className="w-full border-t border-white/5"></div>

      {/* Copyright Bottom Bar (Solid Black) */}
      <div className="w-full bg-black py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mx-5 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Left side: Menu */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              <Link href="/termos" className="hover:text-white transition-colors">Termos e Condições</Link>
              <span className="text-zinc-800">|</span>
              <Link href="/privacidade" className="hover:text-white transition-colors">Política de Privacidade</Link>
            </div>
            {/* Right side: Copyright */}
            <p className="text-xs text-zinc-500 text-center md:text-right">
              &copy; {new Date().getFullYear()} VisualDesign. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
