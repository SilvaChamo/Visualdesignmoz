import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read env
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

import { daBackupListFiles, daBackupViewItems } from '../src/lib/da-backup-api.ts';
import { PANEL_SLUG } from '../src/lib/panel-tenant.ts';
import { listBucketBackups } from '../src/lib/panel-backup-bucket.ts';
import { upsertBackupMirror } from '../src/lib/panel-backup-mirror.ts';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

async function resolveBackupDomain(
  filename,
  accountDomains,
  primaryDomain,
) {
  const domains = accountDomains.length ? accountDomains : [primaryDomain];
  if (/\.sql$/i.test(filename)) {
    const dbName = filename.replace(/\.sql$/i, '');
    console.log(`[debug-backup-sync] Querying panel_databases for dbName=${dbName}...`);
    const { data } = await admin
      .from('panel_databases')
      .select('domain')
      .eq('db_name', dbName);
    console.log(`[debug-backup-sync] Query result for dbName=${dbName}:`, data);
    const matches = (data || []).map((r) => String(r.domain));
    const inAccount = matches.filter((d) => domains.includes(d));
    if (inAccount.length === 1) return inAccount[0];
    if (inAccount.length > 1) {
      return inAccount.find((d) => d === primaryDomain) || inAccount[0];
    }
    if (matches.length) {
      return matches.find((d) => d === primaryDomain) || matches[0];
    }
  }
  return domains.find((d) => filename.toLowerCase().includes(d.toLowerCase())) || primaryDomain;
}

async function debugSync(owner, primaryDomain, accountDomains = []) {
  console.log('[debug-backup-sync] Starting syncBackupsToMirror...');
  
  console.log('[debug-backup-sync] Calling daBackupListFiles...');
  const serverFiles = await daBackupListFiles(owner, primaryDomain);
  console.log(`[debug-backup-sync] Found ${serverFiles.length} server files.`);

  for (const file of serverFiles) {
    console.log(`[debug-backup-sync] Processing file: ${file.filename}`);
    const fileDomain = await resolveBackupDomain(file.filename, accountDomains, primaryDomain);
    console.log(`[debug-backup-sync] Resolved domain for file: ${fileDomain}`);
    
    let scope = file.scope || 'full';
    if (scope === 'full' && !/\.sql$/i.test(file.filename)) {
      try {
        console.log(`[debug-backup-sync] Calling daBackupViewItems for ${file.filename}...`);
        const view = await daBackupViewItems(owner, fileDomain, file.filename);
        console.log(`[debug-backup-sync] daBackupViewItems result:`, view);
        const items = view.items || [];
        if (items.length) {
          // simple inferBackupScope representation
          scope = items.includes('domain') ? 'full' : 'files';
        }
      } catch (err) {
        console.log(`[debug-backup-sync] daBackupViewItems failed: ${err.message}`);
      }
    }

    console.log(`[debug-backup-sync] Upserting mirror row for ${file.filename}...`);
    await upsertBackupMirror({
      owner,
      domain: fileDomain,
      filename: file.filename,
      scope,
      sizeBytes: file.sizeBytes,
      sizeLabel: file.size,
      source: 'server',
      serverPath: file.path,
    });
    console.log(`[debug-backup-sync] Upsert finished for ${file.filename}`);
  }

  console.log('[debug-backup-sync] Calling listBucketBackups...');
  const bucketFiles = await listBucketBackups(owner);
  console.log(`[debug-backup-sync] Found ${bucketFiles.length} bucket files.`);
  
  for (const file of bucketFiles) {
    console.log(`[debug-backup-sync] Upserting mirror row for bucket file: ${file.filename}...`);
    await upsertBackupMirror({
      owner,
      domain: file.domain || primaryDomain,
      filename: file.filename,
      scope: file.scope,
      sizeBytes: file.sizeBytes,
      sizeLabel: file.size,
      source: file.bucketPath ? 'both' : 'bucket',
      bucketPath: file.bucketPath,
    });
  }
  console.log('[debug-backup-sync] Sync complete!');
}

async function run() {
  try {
    await debugSync('admin', 'mltmark.com', ['mltmark.com']);
  } catch (e) {
    console.error('Fatal error during sync debug:', e);
  }
}

run();
