#!/usr/bin/env node
/**
 * Verifica ligação ao Supabase Hetzner antes/depois da migração.
 * Uso: node scripts/verify-supabase-migration.mjs
 * Requer .env.local com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import fs from 'fs'
import path from 'path'

const envPath = path.resolve(process.cwd(), '.env.local')
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local não encontrado')
  process.exit(1)
}

const env = {}
fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
  if (!line || line.startsWith('#') || !line.includes('=')) return
  const [key, ...rest] = line.split('=')
  env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '')
})

const url = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

if (!url || !anonKey) {
  console.error('❌ Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

console.log('🔍 Supabase URL:', url)

const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` }

async function check(label, fetchUrl) {
  try {
    const res = await fetch(fetchUrl, { headers })
    const ok = res.ok || res.status === 401 // 401 sem tabela ainda é "servidor vivo"
    console.log(ok ? '✅' : '❌', label, `→ HTTP ${res.status}`)
    return ok
  } catch (e) {
    console.log('❌', label, '→', e.message)
    return false
  }
}

let passed = 0
if (await check('Auth health', `${url}/auth/v1/health`)) passed++
if (await check('REST API', `${url}/rest/v1/`)) passed++
if (await check('Profiles table', `${url}/rest/v1/profiles?select=id&limit=1`)) passed++

console.log(`\n${passed}/3 checks OK`)
process.exit(passed >= 2 ? 0 : 1)
