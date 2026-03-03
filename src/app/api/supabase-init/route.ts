import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const adminEmails = ['admin@visualdesigne.com', 'silva.chamo@gmail.com', 'geral@visualdesigne.com'];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export async function POST() {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  );
  const { data: { session } } = await supabaseAuth.getSession();

  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const isExplicitAdmin = adminEmails.includes(session.user?.email || '');
  if (session.user?.user_metadata?.role !== 'admin' && !isExplicitAdmin) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to create tables via RPC (requires exec_sql function in Supabase)
    try {
      await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS cyberpanel_sites (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            domain TEXT UNIQUE NOT NULL,
            admin_email TEXT,
            package TEXT,
            owner TEXT,
            status TEXT DEFAULT 'Active',
            disk_usage TEXT,
            bandwidth_usage TEXT,
            synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });
    } catch {
      // RPC not available or table already exists
    }

    try {
      await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS cyberpanel_users (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            first_name TEXT,
            last_name TEXT,
            email TEXT,
            acl TEXT DEFAULT 'user',
            websites_limit INTEGER DEFAULT 0,
            status TEXT DEFAULT 'Active',
            synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });
    } catch {
      // RPC not available or table already exists
    }

    // Test if tables exist by trying to select from them
    const { error: sitesError } = await supabase.from('cyberpanel_sites').select('id').limit(1);
    const { error: usersError } = await supabase.from('cyberpanel_users').select('id').limit(1);

    return NextResponse.json({
      success: true,
      tables: {
        cyberpanel_sites: sitesError ? `Error: ${sitesError.message}` : 'OK',
        cyberpanel_users: usersError ? `Error: ${usersError.message}` : 'OK',
      },
      message: sitesError || usersError
        ? 'Some tables may need manual creation. Run the SQL scripts in Supabase Dashboard > SQL Editor.'
        : 'All tables are ready!'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      instructions: 'Please run the SQL scripts manually in Supabase Dashboard > SQL Editor. Files: supabase-cyberpanel-sites.sql and supabase-cyberpanel-users.sql'
    }, { status: 500 });
  }
}
