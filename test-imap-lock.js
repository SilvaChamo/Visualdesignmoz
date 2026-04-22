const { ImapFlow } = require('imapflow');

async function test() {
  const client = new ImapFlow({
    host: '109.199.104.22',
    port: 993,
    secure: true,
    auth: { user: 'silva.chamo@visualdesigne.com', pass: 'Meckito#77?*' },
    logger: false
  });

  await client.connect();
  let lock = await client.getMailboxLock('Deleted Items');
  try {
    console.log("Deleted Items mailbox exists count:", client.mailbox.exists);
    const searchRes = await client.search({ all: true }, { uid: true });
    console.log("Search ALL uids:", searchRes.length);
  } finally {
    lock.release();
  }
  
  lock = await client.getMailboxLock('INBOX');
  try {
    console.log("INBOX mailbox exists count:", client.mailbox.exists);
    const searchRes = await client.search({ all: true }, { uid: true });
    console.log("INBOX Search ALL uids:", searchRes.length);
  } finally {
    lock.release();
  }

  await client.logout();
}

test().catch(console.error);
