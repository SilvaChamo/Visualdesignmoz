const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

// Parse .env.local for SSH credentials
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
  if (match) {
    env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

const filesToUpload = [
  'src/app/page.tsx',
  'src/lib/panel-mirror-read.ts',
  'src/lib/da-sync-engine.ts',
  'src/lib/panel-list-resolve.ts',
  'src/app/api/panel/bootstrap/route.ts',
  'src/app/api/admin/clientes/route.ts',
  'src/app/api/revendedor/contas/route.ts',
  'src/app/api/panel-dns/route.ts',
  'src/lib/site-font.ts',
  'src/app/layout.tsx',
  'src/app/globals.css',
  'src/styles/globals.css'
];

const conn = new Client();

conn.on('ready', () => {
  console.log('🚀 SSH Connection Ready!');
  
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    let uploadCount = 0;
    
    function uploadNext() {
      if (uploadCount === filesToUpload.length) {
        console.log('✅ All files uploaded successfully via SFTP!');
        buildAndRestart();
        return;
      }
      
      const relPath = filesToUpload[uploadCount];
      const localFilePath = path.join(__dirname, '..', relPath);
      const remoteFilePath = path.join('/opt/visualdesign-panel', relPath);
      
      console.log(`📤 Uploading: ${relPath} -> ${remoteFilePath}`);
      
      sftp.fastPut(localFilePath, remoteFilePath, {}, (putErr) => {
        if (putErr) {
          console.error(`❌ Error uploading ${relPath}:`, putErr);
          conn.end();
          return;
        }
        uploadCount++;
        uploadNext();
      });
    }
    
    uploadNext();
  });
}).on('error', err => {
  console.error('❌ SSH Error:', err);
});

function buildAndRestart() {
  console.log('🔨 Starting Build and Restart on Hetzner Server...');
  
  conn.exec('cd /opt/visualdesign-panel && npm run build && pm2 restart visualdesign-panel && pm2 save', (err, stream) => {
    if (err) {
      console.error('❌ Execution Error:', err);
      conn.end();
      return;
    }
    
    stream.on('data', data => {
      process.stdout.write(data.toString());
    });
    
    stream.stderr.on('data', data => {
      process.stderr.write(data.toString());
    });
    
    stream.on('close', (code) => {
      console.log(`\n🏁 Server command finished with code ${code}`);
      conn.end();
      if (code === 0) {
        console.log('🎉 Hetzner Deploy Completed Successfully!');
      } else {
        console.error('❌ Hetzner Deploy Failed during build/restart.');
      }
    });
  });
}

conn.connect({
  host: env.SSH_HOST || '37.27.17.25',
  port: parseInt(env.SSH_PORT || '2234', 10),
  username: env.SSH_USER || 'root',
  password: env.SSH_PASS || 'Meckito#77?*'
});
