const { ImapFlow } = require('imapflow');

const accounts = [
  { email: 'geral@aamihe.com', pass: 'Ad.Vd#2425?*' },
  { email: 'noreply@aamihe.com', pass: 'Ad.Vd#2425?*' },
  { email: 'affiliead@visualdesignmoz.com', pass: 'Ad.Vd#2425?*' },
  { email: 'geral@visualdesignmoz.com', pass: 'Ad.Vd#2425?*' },
  { email: 'info@visualdesignmoz.com', pass: 'Ad.Vd#2425?*' },
  { email: 'invite@visualdesignmoz.com', pass: 'Ad.Vd#2425?*' },
  { email: 'noreply@visualdesignmoz.com', pass: 'Ad.Vd#2425?*' },
  { email: 'servidor@visualdesignmoz.com', pass: 'Ad.Vd#2425?*' },
  { email: 'silva.chamo@visualdesignmoz.com', pass: 'Ad.Vd#2425?*' },
  { email: 'suporte@visualdesignmoz.com', pass: 'Ad.Vd#2425?*' }
];

async function check(acc) {
  const client = new ImapFlow({
    host: '37.27.17.25',
    port: 993,
    secure: true,
    auth: { user: acc.email, pass: acc.pass },
    tls: { rejectUnauthorized: false },
    logger: false
  });
  try {
    await client.connect();
    const status = await client.status('INBOX', { messages: true, unseen: true });
    console.log(`[${acc.email}] INBOX Messages: ${status.messages} | Unseen: ${status.unseen}`);
    await client.logout();
  } catch(e) {
    console.error(`[${acc.email}] Connection failed:`, e.message);
  }
}

async function run() {
  for (const acc of accounts) {
    await check(acc);
  }
}
run();
