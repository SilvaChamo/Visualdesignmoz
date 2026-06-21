const { ImapFlow } = require('imapflow');

const passwords = [
  'Ad.Vd#2425?*',
  'Meckito#77?*',
  'Visual#0204859?*',
  'Meckito#77',
  'Meckito#77?'
];

async function tryConnect(pass) {
  const client = new ImapFlow({
    host: '37.27.17.25',
    port: 993,
    secure: true,
    auth: { user: 'geral@visualdesignmoz.com', pass: pass },
    tls: { rejectUnauthorized: false },
    logger: false
  });
  try {
    await client.connect();
    console.log(`✅ Success with password: ${pass}`);
    const status = await client.status('INBOX', { messages: true, unseen: true });
    console.log(`   INBOX Messages: ${status.messages} | Unseen: ${status.unseen}`);
    await client.logout();
    return true;
  } catch(e) {
    console.log(`❌ Failed with password: ${pass} (${e.message})`);
    return false;
  }
}

async function run() {
  for (const pass of passwords) {
    const ok = await tryConnect(pass);
    if (ok) break;
  }
}
run();
