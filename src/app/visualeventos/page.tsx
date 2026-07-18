import { BrandPage } from '@/components/BrandPage'
import { getServiceBrand } from '@/lib/services-catalog'

export default function VisualEventosPage() {
  return <BrandPage brand={getServiceBrand('visualeventos')!} />
}
