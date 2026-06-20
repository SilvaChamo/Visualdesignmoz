async function test() {
  const fetch = globalThis.fetch || require('node-fetch');
  try {
    const res = await fetch('http://localhost:3002/api/read-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allAccounts: true,
        folder: 'INBOX'
      })
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Emails:", data);
  } catch (err) {
    console.error("Erro no fetch:", err);
  }
}
test();
