'use client'

import { DNSZoneEditorSection } from './HostingSections'
import type { DirectAdminWebsite } from '@/lib/directadmin-api'

/** DNS Central — editor de zona (leitura instantânea do espelho). */
export function DNSCentralSection({
  sites,
  initialDomain,
}: {
  sites: DirectAdminWebsite[]
  initialDomain?: string
}) {
  return <DNSZoneEditorSection sites={sites} initialDomain={initialDomain} variant="central" />
}
