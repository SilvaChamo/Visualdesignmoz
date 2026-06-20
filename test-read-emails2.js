async function test() {
  const fetch = globalThis.fetch || require('node-fetch');
  try {
    const res = await fetch('http://localhost:3002/api/read-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'silva.chamo@visualdesignmoz.com',
        password: 'Visual#0204859?*',
        folder: 'INBOX'
      })
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Emails count:", data.emails ? data.emails.length : data);
  } catch (err) {
    console.error("Erro no fetch:", err);
  }
}
test();
