const { ImapFlow } = require('imapflow');

async function test() {
  const client = new ImapFlow({
    host: '37.27.17.25',
    port: 993,
    secure: true,
    auth: { user: 'silva.chamo@visualdesignmoz.com', pass: 'Ad.Vd#2425?*' },
    tls: { rejectUnauthorized: false },
    logger: false
  });

  await client.connect();
  const status = await client.status('INBOX', { messages: true });
  console.log('Status of INBOX:', status);
  
  if (status.messages > 0) {
    const lock = await client.getMailboxLock('INBOX');
    try {
      for await (const msg of client.fetch('1:*', { envelope: true, flags: true, uid: true })) {
        console.log('Envelope:', JSON.stringify(msg.envelope, null, 2));
        break; // Just print the first one
      }
    } finally {
      lock.release();
    }
  } else {
    console.log('INBOX is empty!');
  }
  await client.logout();
}

test().catch(console.error);
