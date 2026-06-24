import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from('panel_databases')
    .select('*');
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Found ${data.length} rows in panel_databases:`);
    console.log(data);
  }
}

run();
