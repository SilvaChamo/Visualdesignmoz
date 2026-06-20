const { ImapFlow } = require('imapflow');

async function test() {
  const client = new ImapFlow({
    host: '37.27.17.25',
    port: 993,
    secure: true,
    auth: { user: 'silva.chamo@visualdesignmoz.com', pass: 'Meckito#77?*' }, // using the directadmin pass from .env.local
    tls: { rejectUnauthorized: false },
    logger: false
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = await client.search({ deleted: false }, { uid: true });
      console.log("UIDs na INBOX:", uids);
      for await (const msg of client.fetch(uids.reverse().slice(0, 3), { envelope: true })) {
        console.log("Assunto:", msg.envelope.subject, "Data:", msg.envelope.date);
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    console.error("Erro:", err);
  }
}
test();
