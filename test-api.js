const fetch = require('node-fetch'); // Next.js usa fetch nativo, no Node precisamos usar nativo se Node >= 18

async function testApi() {
  console.log("A testar API para INBOX...");
  const resInbox = await fetch('http://localhost:3002/api/read-emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'silva.chamo@visualdesigne.com',
      password: 'Meckito#77?*',
      folder: 'INBOX'
    })
  });
  const dataInbox = await resInbox.json();
  console.log("Resultado INBOX:", dataInbox.success ? `${dataInbox.emails.length} emails encontrados` : dataInbox.error);

  console.log("\nA testar API para Lixo (Trash)...");
  const resTrash = await fetch('http://localhost:3002/api/read-emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'silva.chamo@visualdesigne.com',
      password: 'Meckito#77?*',
      folder: 'Trash'
    })
  });
  const dataTrash = await resTrash.json();
  console.log("Resultado TRASH:", dataTrash.success ? `${dataTrash.emails.length} emails encontrados` : dataTrash.error);
}

testApi();
