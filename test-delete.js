const { ImapFlow } = require('imapflow');

async function test() {
  const client = new ImapFlow({
    host: 'host.visualdesignmoz.com',
    port: 993,
    secure: true,
    auth: {
      user: 'silva.chamo@visualdesignmoz.com',
      pass: 'Visual#0204859?*'
    },
    tls: { rejectUnauthorized: false },
    logger: false
  });
  
  await client.connect();
  const list = await client.list();
  console.log("Pastas:", list.map(m => m.path + (m.specialUse ? ` (${m.specialUse})` : '')));
  
  const lock = await client.getMailboxLock('INBOX');
  const msgs = [];
  for await (const msg of client.fetch('1:*', { flags: true }, { uid: true })) {
    msgs.push({ uid: msg.uid, flags: Array.from(msg.flags) });
  }
  console.log("Inbox Messages:", msgs);
  lock.release();
  
  await client.logout();
}
test().catch(console.error);
