async function test() {
  const fetch = globalThis.fetch || require('node-fetch');
  
  const payload = {
    to: 'silva.chamo@gmail.com',
    subject: 'Teste de Envio Directo',
    text: 'Funciona?',
    html: '<p>Funciona?</p>',
    from: 'silva.chamo@visualdesignmoz.com',
    fromPassword: 'Visual#0204859?*'
  };

  try {
    const res = await fetch('http://localhost:3002/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log("Resposta:", data);
  } catch (err) {
    console.error("Erro no fetch:", err);
  }
}
test();
