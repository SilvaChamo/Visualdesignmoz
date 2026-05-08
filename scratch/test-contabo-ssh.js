const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ SSH Connection Successful!');
  conn.exec('docker --version && docker-compose --version', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).on('error', (err) => {
  console.error('❌ SSH Connection Failed:', err.message);
}).connect({
  host: '109.199.104.22',
  port: 22,
  username: 'root',
  password: 'Meckito#77?*'
});
