const { ImapFlow } = require('imapflow');

async function test() {
  const client = new ImapFlow({
    host: '37.27.17.25',
    port: 993,
    secure: true,
    auth: { user: 'silva.chamo@visualdesignmoz.com', pass: 'Visual#0204859?*' },
    tls: { rejectUnauthorized: false },
    logger: false
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = await client.search({ deleted: false });
      console.log("UIDs:", uids);
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    console.error("Erro:", err);
  }
}
test();
