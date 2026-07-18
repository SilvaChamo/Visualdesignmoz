import { BrandPage } from '@/components/BrandPage'
import { getServiceBrand } from '@/lib/services-catalog'

export default function VisualGiftsPage() {
  return <BrandPage brand={getServiceBrand('visualgifts')!} />
}
