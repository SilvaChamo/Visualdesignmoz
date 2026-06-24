import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  console.log('=== Backup Schedules ===');
  const { data: schedules, error: schedError } = await supabase
    .from('panel_backup_schedules')
    .select('*');
  if (schedError) {
    console.error('Error fetching schedules:', schedError);
  } else {
    console.log(JSON.stringify(schedules, null, 2));
  }

  console.log('\n=== Backup Files (Mirror) ===');
  const { data: files, error: filesError } = await supabase
    .from('panel_backup_files')
    .select('*')
    .limit(10);
  if (filesError) {
    console.error('Error fetching files:', filesError);
  } else {
    console.log(JSON.stringify(files, null, 2));
  }
}

run();
