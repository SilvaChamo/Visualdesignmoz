const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Parse env file manually
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (match) {
    const key = match[1]
    let value = match[2] || ''
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
    env[key] = value.trim()
  }
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase URL or Key in .env.local")
  process.exit(1)
}

const s = createClient(supabaseUrl, supabaseKey)
s.from('email_contas').select('*').then(r => {
  if (r.error) {
    console.error(r.error)
    return
  }
  r.data.forEach(row => {
    let pass = '';
    try {
      pass = Buffer.from(row.senha_servidor || '', 'base64').toString('utf8');
    } catch(e) {}
    console.log(`Email: ${row.email} | Decrypted Pass: ${pass} | Status: ${row.status}`);
  })
})
