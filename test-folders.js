const { ImapFlow } = require('imapflow');

async function test() {
  const client = new ImapFlow({
    host: '109.199.104.22',
    port: 993,
    secure: true,
    auth: { user: 'silva.chamo@visualdesignmoz.com', pass: 'Meckito#77?*' },
    tls: { rejectUnauthorized: false },
    logger: false
  });

  await client.connect();
  const list = await client.list();
  console.log("Folders:");
  list.forEach(f => console.log(f.path));
  
  const lock = await client.getMailboxLock('INBOX');
  const searchRes = await client.search({ all: true }, { uid: true });
  console.log("INBOX emails:", searchRes);
  lock.release();
  
  await client.logout();
}

test().catch(console.error);
