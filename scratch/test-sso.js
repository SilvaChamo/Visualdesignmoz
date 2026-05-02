const { Client } = require('ssh2');
const fs = require('fs');

// Manual parse .env.local
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) process.env[key.trim()] = value.join('=').trim();
  });
} catch (e) {
  console.log('No .env.local found');
}

const email = 'silva.chamo@visualdesigne.com';
const password = process.env.TEST_PASSWORD || 'Meckito#77?*';
const token = 'TEST_TOKEN_' + Date.now();
const expiresAt = Date.now() + 5 * 60 * 1000;

const SNAPPYMAIL_ADMIN_PATH = '/usr/local/lscp/cyberpanel/snappymail';
const SNAPPYMAIL_DATA_PATH = `${SNAPPYMAIL_ADMIN_PATH}/data/_data_/_default_`;

async function testSSO() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const rawKey = process.env.SSH_PRIVATE_KEY || '';
    const privateKey = rawKey.replace(/\\n/g, '\n');
    const host = process.env.CYBERPANEL_IP || '109.199.104.22';

    conn.on('ready', () => {
      console.log('SSH Ready');
      const tokenCmd = `
mkdir -p ${SNAPPYMAIL_DATA_PATH}/tokens && \
echo '{"email": "${email}", "password": "${password}", "expiresAt": ${expiresAt}}' > ${SNAPPYMAIL_DATA_PATH}/tokens/${token}.json && \
chmod 600 ${SNAPPYMAIL_DATA_PATH}/tokens/${token}.json && \
chown lscpd:lscpd ${SNAPPYMAIL_DATA_PATH}/tokens/${token}.json && \
ls -la ${SNAPPYMAIL_DATA_PATH}/tokens/${token}.json
`;
      conn.exec(tokenCmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => console.log('STDOUT: ' + d));
        stream.stderr.on('data', (d) => console.log('STDERR: ' + d));
        stream.on('close', () => {
          conn.end();
          console.log('Done');
          resolve();
        });
      });
    }).connect({
      host,
      port: 22,
      username: 'root',
      privateKey: Buffer.from(privateKey)
    });
  });
}

testSSO().catch(console.error);
