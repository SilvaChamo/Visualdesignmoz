import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { ADMIN_EMAILS } from '@/lib/user-roles';
import { resolveRoleForAuthUser } from '@/lib/server-auth-role';

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
    data: { session },
  } = await supabase.auth.getSession();

  const sessionUser = session?.user ?? null;
  if (sessionUser?.email) {
    const email = sessionUser.email.toLowerCase();
    const metaRole = sessionUser.user_metadata?.role || sessionUser.app_metadata?.role;
    if (ADMIN_EMAILS.has(email) || metaRole === 'admin' || metaRole === 'manager') {
      return { user: { id: sessionUser.id, email } };
    }
  }

  let user = sessionUser;
  if (!user?.email) {
    const {
      data: { user: verifiedUser },
      error,
    } = await supabase.auth.getUser();
    if (!error && verifiedUser?.email) user = verifiedUser;
  }

  if (!user?.email) {
    return {
      error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }),
    };
  }

  const email = user.email.toLowerCase();
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const roleDb =
    serviceUrl && serviceKey
      ? createServiceClient(serviceUrl, serviceKey)
      : supabase;
  const effectiveRole = await resolveRoleForAuthUser(roleDb, user);

  if (!ADMIN_EMAILS.has(email) && effectiveRole !== 'admin' && effectiveRole !== 'manager') {
    return {
      error: NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 }),
    };
  }

  return { user: { id: user.id, email } };
}
