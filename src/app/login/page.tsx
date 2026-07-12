import { LoginForm } from '@/components/auth/LoginForm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { isPanelHost, getPublicSiteOrigin } from '@/lib/panel-origin'

/** Entrada de login — página real em /login (sem rewrite nem redirect automático). */
export default async function LoginPage() {
  const headersList = await headers()
  const host = headersList.get('host') || ''

  if (isPanelHost(host)) {
    const mainOrigin = getPublicSiteOrigin()
    redirect(`${mainOrigin}/login`)
  }

  return <LoginForm />
}
