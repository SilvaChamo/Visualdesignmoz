const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

// Parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
  if (match) {
    env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection ready!');
  
  // Run checks
  conn.exec('echo "Active path check:" && [ -d /opt/visualdesign-panel ] && echo "/opt/visualdesign-panel exists" || echo "/opt/visualdesign-panel does not exist"; [ -d /home/visualdesignmoz.com/public_html ] && echo "/home/visualdesignmoz.com/public_html exists" || echo "/home/visualdesignmoz.com/public_html does not exist"; pm2 status', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', data => { out += data.toString(); });
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).on('error', err => {
  console.error('SSH Error:', err);
}).connect({
  host: env.SSH_HOST || '37.27.17.25',
  port: parseInt(env.SSH_PORT || '2234', 10),
  username: env.SSH_USER || 'root',
  password: env.SSH_PASS || 'Meckito#77?*'
});
