import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';

// Carregar chaves do .env.local
let apiKey = '';
let secretKey = '';

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
    if (key === 'SPACESHIP_API_KEY') apiKey = val;
    if (key === 'SPACESHIP_SECRET_KEY') secretKey = val;
  });
} catch (e) {
  console.error('Erro ao ler .env.local:', e);
}

if (!apiKey || !secretKey) {
  console.error('Chaves da Spaceship não encontradas no .env.local');
  process.exit(1);
}

function callSpaceship(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    // Fazer a ligação CONNECT para o proxy local
    const req = http.request({
      host: '127.0.0.1',
      port: 55950,
      method: 'CONNECT',
      path: 'spaceship.dev:443'
    });

    req.on('connect', (res, socket, head) => {
      // Configurar o agente HTTPS para usar a socket estabelecida com o proxy
      const agent = new https.Agent({ socket, keepAlive: false });
      
      const headers = {
        'X-API-Key': apiKey,
        'X-API-Secret': secretKey,
        'Accept': 'application/json',
      };
      
      let postData = '';
      if (body) {
        postData = JSON.stringify(body);
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const apiReq = https.request({
        host: 'spaceship.dev',
        path: `/api/v1${path}`,
        method: method,
        agent: agent,
        headers: headers
      }, (apiRes) => {
        let responseBody = '';
        apiRes.on('data', chunk => responseBody += chunk);
        apiRes.on('end', () => {
          resolve({
            status: apiRes.statusCode,
            headers: apiRes.headers,
            body: responseBody
          });
        });
      });

      apiReq.on('error', (err) => {
        reject(err);
      });

      if (body) {
        apiReq.write(postData);
      }
      apiReq.end();
    });

    req.on('error', (err) => {
      reject(new Error(`Erro ao conectar ao proxy: ${err.message}`));
    });

    req.end();
  });
}

async function run() {
  try {
    // 1. Listar domínios (para verificar conectividade)
    console.log('--- Testando listagem de domínios ---');
    const domainsRes = await callSpaceship('/domains?take=1');
    console.log('Status:', domainsRes.status);
    console.log('Body:', domainsRes.body);

    // 2. Testar buscar os contactos existentes
    console.log('\n--- Testando busca de contactos ---');
    const contactsRes = await callSpaceship('/contacts');
    console.log('Status:', contactsRes.status);
    console.log('Body:', contactsRes.body);

    // 3. Testar a criação de um contacto com um payload fictício para forçar a API a devolver erros de validação
    console.log('\n--- Testando criação de contacto com payload vazio para ver o schema de erros ---');
    const createRes = await callSpaceship('/contacts', 'POST', {});
    console.log('Status:', createRes.status);
    console.log('Body:', createRes.body);
  } catch (err) {
    console.error('Erro na execução:', err);
  }
}

run();
