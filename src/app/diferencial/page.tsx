'use client'

import { BrandHero, BrandLandingBody } from '@/components/brands/BrandLanding'
import { BRAND_LANDING_CONTENT } from '@/lib/brand-landing-content'

export default function DiferencialPage() {
  return (
    <div className="min-h-screen bg-black/10 dark:bg-black">
      <BrandHero data={BRAND_LANDING_CONTENT['diferencial']} breadcrumb="Início / Diferencial" />
      <BrandLandingBody data={BRAND_LANDING_CONTENT['diferencial']} />
    </div>
  )
}
