import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { directAdminAPI } from '@/lib/directadmin-api';
import type { DirectAdminWebsite } from '@/lib/directadmin-api';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const STANDARD_PASSWORD = process.env.STANDARD_EMAIL_PASSWORD || 'Ad.Vd#2425?*';

export async function POST() {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Supabase Service Role não configurado.' },
        { status: 500 },
      );
    }

    const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const sites = await directAdminAPI.listWebsites() as DirectAdminWebsite[];
    const domains = Array.from(new Set(sites.map((site: DirectAdminWebsite) => site.domain).filter(Boolean)));

    const results: {
      totalDomains: number;
      emailsFound: number;
      usersCreated: number;
      errors: string[];
    } = {
      totalDomains: domains.length,
      emailsFound: 0,
      usersCreated: 0,
      errors: [],
    };

    for (const domain of domains) {
      const emailAccounts = await directAdminAPI.listEmails(domain).catch((error: any) => {
        results.errors.push(`${domain}: ${error?.message || 'Erro ao listar emails no DirectAdmin'}`);
        return [];
      });

      results.emailsFound += emailAccounts.length;

      for (const account of emailAccounts) {
        const email = account.email || `${account.user}@${domain}`;

        try {
          const { data: users, error: listError } = await admin.auth.admin.listUsers();
          if (listError) throw listError;

          const existingUser = users.users.find(user => user.email?.toLowerCase() === email.toLowerCase());
          let userId = existingUser?.id;

          if (!userId) {
            const { data: newUser, error: createError } = await admin.auth.admin.createUser({
              email,
              password: STANDARD_PASSWORD,
              email_confirm: true,
              user_metadata: { role: 'client', nome: email.split('@')[0], domain },
            });

            if (createError) throw createError;
            userId = newUser.user.id;
            results.usersCreated++;
          }

          const { data: siteData } = await admin
            .from('site_clientes')
            .select('id')
            .eq('dominio', domain)
            .maybeSingle();

          await admin.from('profiles').upsert({
            id: userId,
            email,
            nome: email.split('@')[0],
            role: 'client',
          }, { onConflict: 'id' });

          await admin.from('email_contas').upsert({
            email,
            status: account.status || 'active',
            tipo_conta: 'webmail',
            cliente_id: userId,
            site_id: siteData?.id || null,
          }, { onConflict: 'email' });
        } catch (error: any) {
          results.errors.push(`${email}: ${error?.message || 'Erro ao sincronizar conta'}`);
        }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
