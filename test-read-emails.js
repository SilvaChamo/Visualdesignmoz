async function test() {
  const fetch = globalThis.fetch || require('node-fetch');
  try {
    const res = await fetch('http://localhost:3002/api/read-emails?folder=INBOX', {
      method: 'GET'
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Emails count:", data.emails ? data.emails.length : data);
  } catch (err) {
    console.error("Erro no fetch:", err);
  }
}
test();
