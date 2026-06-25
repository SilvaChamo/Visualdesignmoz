import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Carregar variáveis de ambiente do .env.local manualmente
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
    process.env[key] = val;
  });
} catch (e) {
  console.error('Erro ao ler .env.local:', e);
}

const SPACESHIP_API_URL = 'https://spaceship.dev/api/v1';
const apiKey = process.env.SPACESHIP_API_KEY;
const secretKey = process.env.SPACESHIP_SECRET_KEY;

console.log('SPACESHIP_API_KEY:', apiKey ? 'CONFIGURADO' : 'NÃO CONFIGURADO');

async function testEndpoint(endpoint, method = 'GET', body = null) {
  console.log(`\n--- Testando ${method} ${endpoint} ---`);
  try {
    const res = await fetch(`${SPACESHIP_API_URL}${endpoint}`, {
      method,
      headers: {
        'X-API-Key': apiKey,
        'X-API-Secret': secretKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : null,
    });
    
    console.log('Status:', res.status, res.statusText);
    const headers = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    console.log('Headers:', headers);
    
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      console.log('JSON Response:', JSON.stringify(json, null, 2));
    } catch {
      console.log('Text Response (first 500 chars):', text.substring(0, 500));
    }
  } catch (err) {
    console.error('Erro na requisição:', err);
  }
}

async function run() {
  // Testar listagem de domínios (para validar chaves)
  await testEndpoint('/domains?take=1');
  
  // Testar ler detalhes de contactos
  await testEndpoint('/contacts');
}

run();
