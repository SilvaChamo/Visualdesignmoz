// Script de teste para criação de domínio
import fetch from 'node-fetch';

const TEST_DOMAIN = 'testdomain12345.com';
const TEST_EMAIL = 'admin@testdomain12345.com';

async function testCreateDomain() {
  console.log('🧪 Testando criação de domínio...\n');
  
  try {
    console.log('📡 Enviando requisição para /api/server-exec');
    console.log(`   Domain: ${TEST_DOMAIN}`);
    console.log(`   Email: ${TEST_EMAIL}`);
    console.log('');
    
    const res = await fetch('http://localhost:3000/api/server-exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createWebsite',
        params: {
          domain: TEST_DOMAIN,
          email: TEST_EMAIL,
          php: 'PHP 8.2',
          openLiteSpeed: true
        }
      })
    });
    
    const data = await res.json();
    
    console.log('📥 Resposta da API:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('\n✅ Domínio criado com sucesso!');
    } else {
      console.log('\n❌ Erro ao criar domínio:');
      console.log(data.error || data.data?.output || 'Erro desconhecido');
    }
    
  } catch (e) {
    console.error('\n💥 Erro na requisição:', e.message);
  }
}

// Teste 2: Verificar se a API está respondendo
async function testAPIHealth() {
  console.log('\n🏥 Testando saúde da API...\n');
  
  try {
    const res = await fetch('http://localhost:3000/api/server-exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'listWebsites',
        params: {}
      })
    });
    
    const data = await res.json();
    
    if (data.success) {
      console.log('✅ API está respondendo');
      console.log(`   Domínios encontrados: ${data.data?.sites?.length || 0}`);
    } else {
      console.log('❌ API retornou erro:', data.error);
    }
    
  } catch (e) {
    console.error('💥 API não está respondendo:', e.message);
    console.log('   Verifique se o servidor Next.js está rodando (npm run dev)');
  }
}

async function main() {
  await testAPIHealth();
  await testCreateDomain();
}

main().catch(console.error);
