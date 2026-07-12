const { ImapFlow } = require('imapflow');

async function test() {
  const client = new ImapFlow({
    host: '37.27.17.25',
    port: 993,
    secure: true,
    auth: { user: 'silva.chamo@visualdesignmoz.com', pass: 'Meckito#77?*' },
    tls: { rejectUnauthorized: false },
    logger: false
  });

  await client.connect();
  const list = await client.list();
  console.log("Folders found:");
  for (const f of list) {
    const status = await client.status(f.path, { messages: true, unseen: true });
    console.log(`Path: ${f.path} | Name: ${f.name} | Total: ${status.messages} | Unseen: ${status.unseen}`);
  }
  await client.logout();
}

test().catch(console.error);
