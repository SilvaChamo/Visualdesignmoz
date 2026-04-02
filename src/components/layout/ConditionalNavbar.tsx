'use client'

import { usePathname } from 'next/navigation'
import { Navbar } from './Navbar'

/**
 * Conditionally renders the Navbar based on the current route.
 * Admin (/admin) and Client (/client) panels are excluded.
 */
export function ConditionalNavbar() {
  const pathname = usePathname()

  // Routes that should NOT show the Navbar
  const excludedRoutes = ['/admin', '/client', '/dashboard', '/auth']

  const isExcluded = excludedRoutes.some(route => pathname.startsWith(route))

  if (isExcluded) return null

  return <Navbar />
}
