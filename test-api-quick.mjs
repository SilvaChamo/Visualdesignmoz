// Teste rápido da API de email
const API_URL = 'http://localhost:3002/api/mailmarketing-send';

const testData = {
  to: ['test@example.com'],
  subject: 'Teste API',
  content: '<p>Teste</p>',
  sender: 'test@visualdesigne.com',
  domain: 'visualdesigne.com'
};

console.log('🧪 Testando API:', API_URL);
console.log('📤 Dados:', JSON.stringify(testData, null, 2));

try {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData)
  });
  
  console.log('📡 Status:', res.status);
  const data = await res.json();
  console.log('📡 Resposta:', JSON.stringify(data, null, 2));
} catch (e) {
  console.error('❌ Erro:', e.message);
}
