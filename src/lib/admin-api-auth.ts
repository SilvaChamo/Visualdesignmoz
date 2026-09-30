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
  // getUser() valida o token no servidor de auth. O atalho antigo com getSession() lia o
  // cookie sem o verificar e aceitava o role do user_metadata (editável pelo próprio
  // utilizador) — qualquer conta podia passar por admin.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return {
      error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }),
    };
  }

  const email = user.email.toLowerCase();
  if (ADMIN_EMAILS.has(email) || user.app_metadata?.role === 'admin') {
    return { user: { id: user.id, email } };
  }

  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const roleDb =
    serviceUrl && serviceKey
      ? createServiceClient(serviceUrl, serviceKey)
      : supabase;
  const effectiveRole = await resolveRoleForAuthUser(roleDb, user);

  if (!ADMIN_EMAILS.has(email) && effectiveRole !== 'admin') {
    return {
      error: NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 }),
    };
  }

  return { user: { id: user.id, email } };
}
