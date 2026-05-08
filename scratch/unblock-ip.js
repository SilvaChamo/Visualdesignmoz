const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ SSH Connection Successful!');
  
  // Comandos para limpar blacklist do DirectAdmin e CSF
  const commands = [
    'echo "" > /usr/local/directadmin/data/admin/brute_force_list',
    'if command -v csf >/dev/null 2>&1; then csf -df; fi',
    'service directadmin restart'
  ].join(' && ');

  console.log('Running unblock commands...');
  
  conn.exec(commands, (err, stream) => {
    if (err) {
      console.error('❌ Error executing commands:', err);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      console.log('✅ Commands completed with code: ' + code);
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
