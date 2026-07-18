import { BrandPage } from '@/components/BrandPage'
import { getServiceBrand } from '@/lib/services-catalog'

export default function VisualTransportePage() {
  return <BrandPage brand={getServiceBrand('visualtransporte')!} />
}
