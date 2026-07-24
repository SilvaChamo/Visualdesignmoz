'use client'

import { BrandLanding } from '@/components/brands/BrandLanding'
import { BRAND_LANDING_CONTENT } from '@/lib/brand-landing-content'

export default function VisualTransportePage() {
  return (
    <div className="min-h-screen bg-black/10 dark:bg-black">
      <BrandLanding data={BRAND_LANDING_CONTENT['transporte']} />
    </div>
  )
}
