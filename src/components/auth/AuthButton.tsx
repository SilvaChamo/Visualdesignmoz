'use client'

import { useState } from 'react'
import { startGoogleOAuth } from '@/lib/supabase-oauth-browser'
import { supabase } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

export function AuthButton() {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)

  const signInWithGoogle = async () => {
    setLoading(true)
    
    await startGoogleOAuth()
    
    setLoading(false)
  }

  const signOut = async () => {
    setLoading(true)
    
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Error signing out:', error.message)
    }
    
    setLoading(false)
  }

  return (
    <div className="flex items-center space-x-4">
      <Button
        onClick={signInWithGoogle}
        disabled={loading}
        variant="outline"
        className="border-white text-white hover:bg-white hover:text-black"
      >
        {loading ? 'Carregando...' : 'Entrar com Google'}
      </Button>
    </div>
  )
}
