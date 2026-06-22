'use client'

import { getOAuthCallbackUrl, redirectToCanonicalAuthHostIfNeeded } from '@/lib/oauth-callback'
import { createClientInstance } from '@/lib/supabase-client'

/** Um botão → uma rota de callback (definida pelo ambiente, não pelo utilizador). */
export async function startGoogleOAuth() {
  if (redirectToCanonicalAuthHostIfNeeded()) return

  const redirectTo = getOAuthCallbackUrl()
  const client = createClientInstance()
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { access_type: 'offline', prompt: 'select_account' },
    },
  })
  if (error) throw error
}
