const fetch = require('node-fetch');

async function testApi() {
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
  console.log("INBOX API Response Emails:", dataInbox.emails ? dataInbox.emails.length : "none");
  if (dataInbox.emails && dataInbox.emails.length > 0) {
    console.log("First email in INBOX:", dataInbox.emails[0].assunto);
  }
}

testApi();
