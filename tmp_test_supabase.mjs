import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testSupabase() {
    console.log("Testing listarSubscritores...");
    let query = supabase
      .from('newsletter_subscribers')
      .select('*')
      .order('created_at', { ascending: false });

    // query = query.contains('metadata', { domain: 'visualdesignmoz.com' }); // test with contains

    const result = await query;
    console.log("Result no-filter:", JSON.stringify(result, null, 2));
    
    console.log("Testing filter syntax...");
    let query2 = supabase.from('newsletter_subscribers').select('*').contains('metadata', { domain: 'test' });
    const result2 = await query2;
    console.log("Result with contains:", JSON.stringify(result2, null, 2));
}

testSupabase();
