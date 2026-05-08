const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Ready');
  conn.exec('ss -tulpn | grep directadmin', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '109.199.104.22',
  port: 2234,
  username: 'root',
  password: 'Meckito#77?*'
});
