import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ADMIN_EMAILS } from '@/lib/user-roles';

type AdminAuthSuccess = {
  user: {
    id: string;
    email: string;
  };
};

type AdminAuthFailure = {
  error: NextResponse;
};

export async function requireAdmin(): Promise<AdminAuthSuccess | AdminAuthFailure> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return {
      error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }),
    };
  }

  const email = user.email.toLowerCase();
  const metaRole = user.user_metadata?.role || user.app_metadata?.role;

  if (!ADMIN_EMAILS.has(email) && metaRole !== 'admin') {
    return {
      error: NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 }),
    };
  }

  return { user: { id: user.id, email } };
}
