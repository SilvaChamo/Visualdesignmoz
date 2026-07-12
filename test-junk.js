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
  let lock = await client.getMailboxLock('INBOX.Junk');
  const searchRes = await client.search({ all: true }, { uid: true });
  console.log("INBOX.Junk emails:", searchRes.length);
  lock.release();
  
  lock = await client.getMailboxLock('INBOX.Junk E-mail');
  const searchRes2 = await client.search({ all: true }, { uid: true });
  console.log("INBOX.Junk E-mail emails:", searchRes2.length);
  lock.release();

  await client.logout();
}

test().catch(console.error);
