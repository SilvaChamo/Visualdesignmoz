const { Client } = require('ssh2');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const startIndex = envContent.indexOf('SSH_PRIVATE_KEY="') + 17;
const endIndex = envContent.indexOf('-----END OPENSSH PRIVATE KEY-----"') + 33;
const rawKeyBlock = envContent.substring(startIndex, endIndex);

const privateKey = rawKeyBlock;

const conn = new Client();
conn.on('ready', () => {
  console.log('=== SERVIDOR CONTABO - RELATÓRIO IMEDIATO ===');
  conn.exec('echo "[MEMÓRIA RAM]" && free -m && echo "\n[CPU e CARGA]" && uptime && echo "\n[OOM KILLS RECENTES]" && dmesg | tail -n 100 | grep -i "out of memory" || echo "Sem OOM no dmesg" && echo "\n[PROCESSOS PHP-FPM]" && ps aux | grep php-fpm | wc -l && echo "\n[TOP 10 GULOSOS (RAM)]" && ps aux --sort=-%mem | head -n 10', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).on('error', (err) => {
  console.error("Connection error:", err.message);
}).connect({
  host: '37.27.17.25',
  port: 22,
  username: 'root',
  privateKey: privateKey,
  readyTimeout: 15000
});
