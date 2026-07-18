import { BrandPage } from '@/components/BrandPage'
import { getServiceBrand } from '@/lib/services-catalog'

export default function VisualDesignBrandPage() {
  return <BrandPage brand={getServiceBrand('visualdesign')!} />
}
