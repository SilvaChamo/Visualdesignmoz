import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const CREDENCIAIS_PADRAO = {
  'silva.chamo@visualdesignmoz.com': 'Meckito#77?*',
  'duduchamatavele@visualdesignmoz.com': 'Dudu#2425?*',
  'geral@visualdesignmoz.com': 'Ge.Vd#2425?*',
  'admin@visualdesignmoz.com': 'Ad.Vd#2425?*',
  'info@visualdesignmoz.com': 'Informação!#2020?*',
  'suporte@visualdesignmoz.com': 'SupaEmail#2026?*',
  'noreply@visualdesignmoz.com': 'VisualDesign#2026',
  'marketing@visualdesignmoz.com': 'mark#mail2026?*',
}

async function syncPasswords() {
  console.log('--- Iniciando Sincronização de Senhas ---')
  
  for (const [email, pass] of Object.entries(CREDENCIAIS_PADRAO)) {
    const passBase64 = Buffer.from(pass).toString('base64')
    
    const { error } = await supabase
      .from('email_contas')
      .upsert({ 
        email, 
        senha_cyberpanel: passBase64,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' })
      
    if (error) {
      console.error(`Erro ao sincronizar ${email}:`, error.message)
    } else {
      console.log(`✅ Sincronizado: ${email}`)
    }
  }
  
  console.log('--- Sincronização Concluída ---')
}

syncPasswords()
