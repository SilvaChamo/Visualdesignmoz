const fetch = require('node-fetch');

async function testApi() {
  const resInbox = await fetch('http://localhost:3002/api/read-emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'silva.chamo@visualdesignmoz.com',
      password: 'Meckito#77?*',
      folders: ['INBOX'],
      limit: 50,
      includeTotals: true
    })
  });
  const dataInbox = await resInbox.json();
  console.log("Success:", dataInbox.success);
  console.log("INBOX API Response Emails:", dataInbox.emails ? dataInbox.emails.length : "none");
  if (dataInbox.emails && dataInbox.emails.length > 0) {
    console.log("First email in INBOX:", dataInbox.emails[0].assunto);
  }
}

testApi();
