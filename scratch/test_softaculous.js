
const DA_HOST = process.env.DIRECTADMIN_HOST || '109.199.104.22';
const DA_PORT = process.env.DIRECTADMIN_PORT || '2222';
const DA_USER = process.env.DIRECTADMIN_USER || 'admin';
const DA_PASS = process.env.DIRECTADMIN_PASS || 'Meckito#77?*';

const DA_BASE = `https://${DA_HOST}:${DA_PORT}`;

async function daGet(cmd, qs = {}) {
  const params = new URLSearchParams({ json: 'yes', ...qs });
  const url = `${DA_BASE}/${cmd}?${params}`;
  const headers = {
    Authorization: 'Basic ' + Buffer.from(`${DA_USER}:${DA_PASS}`).toString('base64'),
  };
  const res = await fetch(url, { headers });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function test() {
  console.log('--- Testing Softaculous List ---');
  const list = await daGet('CMD_API_SOFTACULOUS', { act: 'installations' });
  console.log('Installations:', JSON.stringify(list, null, 2));

  if (list && list.installations) {
    const firstIns = Object.values(list.installations)[0];
    if (firstIns) {
      const insid = Object.keys(list.installations)[0];
      console.log(`--- Testing Sign On for ${firstIns.domain} (insid: ${insid}) ---`);
      const signOn = await daGet('CMD_API_SOFTACULOUS', { act: 'sign_on', insid });
      console.log('Sign On Response:', JSON.stringify(signOn, null, 2));
    }
  }
}

test();
