import { readFileSync } from 'fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

import { daBackupCreate, daBackupListFiles } from '../src/lib/da-backup-api.ts';
import { uploadBackupFileToBucket } from '../src/lib/panel-backup-bucket.ts';

const owner = 'admin';
const domain = 'mltmark.com';
const items = ['database'];

async function run() {
  console.log(`=== Testing Backup Creation for domain=${domain} ===`);
  const before = await daBackupListFiles(owner, domain);
  console.log(`Files before backup: ${before.length}`);

  console.log('Calling daBackupCreate...');
  const result = await daBackupCreate(owner, domain, items);
  console.log('Result of daBackupCreate:', result);

  if (!result.ok) {
    console.error('Backup creation failed:', result.error);
    return;
  }

  console.log('Backup creation command succeeded. Filename from API:', result.filename);
  
  // Wait a few seconds for the file to appear or look for it
  console.log('Waiting 5 seconds for file to be generated on server...');
  await new Promise((r) => setTimeout(r, 5000));

  const after = await daBackupListFiles(owner, domain);
  console.log(`Files after backup: ${after.length}`);
  
  const diff = after.filter(a => !before.some(b => b.filename === a.filename));
  console.log('New files found:', diff);

  const targetFile = result.filename || diff[0]?.filename;
  if (!targetFile) {
    console.error('Could not find the newly created backup file.');
    return;
  }

  console.log(`Attempting to upload file to bucket: ${targetFile}`);
  const uploadResult = await uploadBackupFileToBucket(owner, domain, 'databases', targetFile);
  console.log('Upload result:', uploadResult);
}

run();
