const { Client } = require('ssh2');
const fs = require('fs');

try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) process.env[key.trim()] = value.join('=').trim();
  });
} catch (e) {}

async function diagnoseSSO() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const rawKey = process.env.SSH_PRIVATE_KEY || '';
    const privateKey = rawKey.replace(/\\n/g, '\n');
    const host = process.env.CYBERPANEL_IP || '109.199.104.22';

    conn.on('ready', () => {
      const cmd = `
        echo "--- CHECKING DIRECTORIES ---"
        ls -ld /usr/local/lscp/cyberpanel/snappymail/data/_data_/_default_ || echo "Default data dir not found"
        mkdir -p /usr/local/lscp/cyberpanel/snappymail/data/_data_/_default_/tokens
        ls -ld /usr/local/lscp/cyberpanel/snappymail/data/_data_/_default_/tokens
        
        echo "--- CHECKING PERMISSIONS ---"
        ls -la /usr/local/lscp/cyberpanel/snappymail/data/_data_/_default_/ | head -n 20
        
        echo "--- TESTING WRITE ---"
        echo '{"test":true}' > /usr/local/lscp/cyberpanel/snappymail/data/_data_/_default_/tokens/test_token.json
        cat /usr/local/lscp/cyberpanel/snappymail/data/_data_/_default_/tokens/test_token.json
        rm /usr/local/lscp/cyberpanel/snappymail/data/_data_/_default_/tokens/test_token.json
      `;
      
      conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => console.log('STDOUT: ' + d));
        stream.stderr.on('data', (d) => console.log('STDERR: ' + d));
        stream.on('close', () => {
          conn.end();
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

diagnoseSSO().catch(console.error);
