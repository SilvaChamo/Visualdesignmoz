import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const admin = createClient(url, key);
const sql = readFileSync('scripts/migrate-da-sync-mirror.sql', 'utf8');
const { error: rpcErr } = await admin.rpc('exec_sql', { sql });
console.log(rpcErr ? `exec_sql: ${rpcErr.message}` : 'migration: ok');

const { error: probe } = await admin.from('panel_sync_log').select('id').limit(1);
console.log(probe ? `panel_sync_log: ${probe.message}` : 'panel_sync_log: ok');
