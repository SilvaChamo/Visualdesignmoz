'use client'

import { usePathname } from 'next/navigation'
import { Navbar } from './Navbar'
import { Header } from './Header'

/**
 * Conditionally renders the Header based on the current route.
 * Admin (/dashboard) and Client (/client) panels are excluded.
 */
export function ConditionalNavbar() {
  const pathname = usePathname()

  // Routes that should NOT show the Header
  const excludedRoutes = ['/dashboard', '/client', '/auth', '/login', '/revendedor', '/guest']

  const isExcluded = excludedRoutes.some(route => pathname.startsWith(route))

  if (isExcluded) return null

  return (
    <>
      <Navbar />
      <Header />
    </>
  )
}
