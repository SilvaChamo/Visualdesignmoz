import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { resolveRoleForAuthUser } from '@/lib/server-auth-role';

import { ADMIN_EMAILS } from '@/lib/user-roles';

export type PanelAuthSuccess = {
  user: {
    id: string;
    email?: string;
    role: 'admin' | 'reseller';
  };
};

type PanelAuthFailure = {
  error: NextResponse;
};

export async function requireAdminOrReseller(): Promise<PanelAuthSuccess | PanelAuthFailure> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let user = session?.user ?? null;
  if (!user) {
    const {
      data: { user: verifiedUser },
      error,
    } = await supabase.auth.getUser();
    if (!error && verifiedUser) user = verifiedUser;
  }

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }),
    };
  }

  const email = (user.email || '').toLowerCase();
  const metadataRole = user.user_metadata?.role || user.app_metadata?.role;

  let effectiveRole = metadataRole;
  if (!effectiveRole || (effectiveRole !== 'admin' && effectiveRole !== 'manager' && effectiveRole !== 'reseller')) {
    try {
      effectiveRole = await resolveRoleForAuthUser(supabase, user);
    } catch {
      /* manter metadata */
    }
  }

  if (effectiveRole === 'admin' || effectiveRole === 'manager' || ADMIN_EMAILS.has(email)) {
    return { user: { id: user.id, email, role: 'admin' } };
  }

  if (effectiveRole === 'reseller') {
    return { user: { id: user.id, email, role: 'reseller' } };
  }

  return {
    error: NextResponse.json({ error: 'Acesso restrito a administradores ou revendedores' }, { status: 403 }),
  };
}

export type PanelBootstrapAuthSuccess = {
  user: {
    id: string;
    email?: string;
    role: 'admin' | 'reseller' | 'client';
  };
};

export async function requirePanelBootstrapAccess(): Promise<
  PanelBootstrapAuthSuccess | PanelAuthFailure
> {
  const staff = await requireAdminOrReseller();
  if (!('error' in staff)) {
    return { user: { ...staff.user, role: staff.user.role } };
  }

  const supabase = await createClient();
  const {
    data: { user: verifiedUser },
    error,
  } = await supabase.auth.getUser();

  let user = verifiedUser;
  if (error || !user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    user = session?.user ?? null;
  }

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }),
    };
  }

  const email = (user.email || '').toLowerCase();
  let effectiveRole = user.user_metadata?.role || user.app_metadata?.role;
  if (!effectiveRole || (effectiveRole !== 'admin' && effectiveRole !== 'reseller' && effectiveRole !== 'client')) {
    try {
      effectiveRole = await resolveRoleForAuthUser(supabase, user);
    } catch {
      /* manter metadata */
    }
  }

  if (effectiveRole === 'client') {
    return { user: { id: user.id, email, role: 'client' } };
  }

  if (effectiveRole === 'admin' || ADMIN_EMAILS.has(email)) {
    return { user: { id: user.id, email, role: 'admin' } };
  }

  if (effectiveRole === 'reseller') {
    return { user: { id: user.id, email, role: 'reseller' } };
  }

  return {
    error: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }),
  };
}
