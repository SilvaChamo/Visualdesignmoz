const https = require('https');

const data = JSON.stringify({
  carteira: "cqg275a",
  numero: "840000000",
  cliente: "Teste Antigravity",
  valor: "1"
});

const options = {
  hostname: 'mozpayment.co.mz',
  port: 443,
  path: '/api/1.1/wf/pagamentorotativoemola',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('Enviando requisição para MozPayment...');

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status HTTP:', res.statusCode);
    console.log('Resposta Bruta:', body);
    try {
      const json = JSON.parse(body);
      console.log('JSON Interpretado:', json);
      if (json.cod === 200) {
        console.log('✓ Sucesso detectado pelo código interno!');
      } else {
        console.log('✗ Falha detectada pelo código interno.');
      }
    } catch (e) {
      console.log('Não foi possível ler como JSON.');
    }
  });
});

req.on('error', (e) => {
  console.error('Erro na requisição:', e.message);
});

req.write(data);
req.end();
