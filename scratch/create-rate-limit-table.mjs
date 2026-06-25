import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

// Configurar proxy para o node-fetch/undici local
if (process.env.HTTP_PROXY || process.env.http_proxy) {
  const proxyUrl = process.env.HTTP_PROXY || process.env.http_proxy;
  console.log('Configurando ProxyAgent para undici:', proxyUrl);
  const proxyAgent = new ProxyAgent(proxyUrl);
  setGlobalDispatcher(proxyAgent);
}

// Carregar .env.local
let supabaseUrl = '';
let serviceRoleKey = '';

try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const firstEquals = trimmed.indexOf('=');
    if (firstEquals === -1) return;
    const key = trimmed.slice(0, firstEquals).trim();
    let val = trimmed.slice(firstEquals + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val;
    if (key === 'SUPABASE_SERVICE_ROLE_KEY') serviceRoleKey = val;
  });
} catch (e) {
  console.error('Erro ao ler .env.local:', e);
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Chaves do Supabase não encontradas no .env.local');
  process.exit(1);
}

if (supabaseUrl.includes('visualdesignmoz.com')) {
  console.log('Redirecionando URL customizada do Supabase para a URL nativa da nuvem...');
  supabaseUrl = 'https://gwankhxcbkrtgxopbxwd.supabase.co';
}

console.log('Conectando ao Supabase em:', supabaseUrl);
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.domain_check_logs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      domain TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_domain_check_logs_domain_created 
      ON public.domain_check_logs (domain, created_at DESC);

    -- Habilitar RLS e criar políticas caso seja acedido publicamente (embora só a usemos na API backend)
    ALTER TABLE public.domain_check_logs ENABLE ROW LEVEL SECURITY;
    
    -- Permitir escrita/leitura interna de service role
  `;

  console.log('Executando SQL...');
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  
  if (error) {
    console.error('Erro ao criar tabela:', error);
  } else {
    console.log('Tabela domain_check_logs criada com sucesso ou já existente!');
  }
}

run();
