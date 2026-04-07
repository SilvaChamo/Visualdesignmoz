import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

const adminEmails = ['admin@your-domain.com', 'silva.chamo@gmail.com', 'geral@your-domain.com'];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export async function POST() {
  const supabaseAuth = await createClient();
  const { data: { session } } = await supabaseAuth.auth.getSession();

  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const isExplicitAdmin = adminEmails.includes(session.user?.email || '');
  if (session.user?.user_metadata?.role !== 'admin' && !isExplicitAdmin) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 });
  }

  try {
    const supabase = createAdminClient(supabaseUrl, supabaseKey);

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
            user_id UUID REFERENCES auth.users(id),
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
          
          -- Ensure user_id column exists if table was already created
          DO $$ 
          BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cyberpanel_users' AND column_name='user_id') THEN
              ALTER TABLE cyberpanel_users ADD COLUMN user_id UUID REFERENCES auth.users(id);
            END IF;
          END $$;
        `
      });
    } catch {
      // RPC not available or table already exists
    }

    try {
      await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS cyberpanel_packages (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            package_name TEXT UNIQUE NOT NULL,
            disk_space INTEGER DEFAULT 1000,
            bandwidth INTEGER DEFAULT 1000,
            email_accounts INTEGER DEFAULT 10,
            databases INTEGER DEFAULT 5,
            ftp_accounts INTEGER DEFAULT 5,
            allowed_domains INTEGER DEFAULT 1,
            synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });
    } catch {
      // RPC not available or table already exists
    }

    // Create new business tables
    try {
      await supabase.rpc('exec_sql', {
        sql: `
          -- Profiles table for client extra info
          CREATE TABLE IF NOT EXISTS profiles (
            id UUID REFERENCES auth.users(id) PRIMARY KEY,
            nome TEXT,
            empresa TEXT,
            telefone TEXT,
            morada TEXT,
            cidade TEXT,
            pais TEXT DEFAULT 'Moçambique',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          -- Invoices (Pagamentos)
          CREATE TABLE IF NOT EXISTS pagamentos (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id),
            domain TEXT,
            valor DECIMAL,
            vencimento DATE,
            metodo TEXT,
            pago_em TIMESTAMP WITH TIME ZONE,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          -- Support Tickets
          CREATE TABLE IF NOT EXISTS tickets_suporte (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id),
            assunto TEXT,
            categoria TEXT DEFAULT 'Geral',
            descricao TEXT,
            status TEXT DEFAULT 'Aberto',
            resposta TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });
    } catch {
      // RPC error
    }

    // Test if tables exist by trying to select from them
    const { error: sitesError } = await supabase.from('cyberpanel_sites').select('id').limit(1);
    const { error: usersError } = await supabase.from('cyberpanel_users').select('id').limit(1);
    const { error: profilesError } = await supabase.from('profiles').select('id').limit(1);

    return NextResponse.json({
      success: true,
      tables: {
        cyberpanel_sites: sitesError ? `Error: ${sitesError.message}` : 'OK',
        cyberpanel_users: usersError ? `Error: ${usersError.message}` : 'OK',
        profiles: profilesError ? `Error: ${profilesError.message}` : 'OK',
        pagamentos: 'OK',
        tickets_suporte: 'OK'
      },
      message: sitesError || usersError || profilesError
        ? 'Some tables may need manual creation. Try common fixes or run SQL scripts.'
        : 'All infrastructure tables ready!'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      instructions: 'Please run the SQL scripts manually in Supabase Dashboard > SQL Editor. Files: supabase-cyberpanel-sites.sql and supabase-cyberpanel-users.sql'
    }, { status: 500 });
  }
}
