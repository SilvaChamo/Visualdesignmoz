import { BrandPage } from '@/components/BrandPage'
import { getServiceBrand } from '@/lib/services-catalog'

export default function VisualWebPage() {
  return <BrandPage brand={getServiceBrand('visualweb')!} />
}
