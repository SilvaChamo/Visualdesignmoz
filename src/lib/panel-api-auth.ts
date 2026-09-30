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

/** "manager" (conta profissional) tem scope próprio — nunca acesso admin. */
export type PanelStaffAuthSuccess = {
  user: {
    id: string;
    email?: string;
    role: 'admin' | 'reseller' | 'manager';
  };
};

type PanelAuthFailure = {
  error: NextResponse;
};

const STAFF_ACCESS_DENIED = () => ({
  error: NextResponse.json({ error: 'Acesso restrito a administradores ou revendedores' }, { status: 403 }),
});

async function resolvePanelStaffAuth(): Promise<PanelStaffAuthSuccess | PanelAuthFailure> {
  const supabase = await createClient();
  // Só o getUser() valida o token; o getSession() lia o cookie sem verificação.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }),
    };
  }

  const email = (user.email || '').toLowerCase();

  // Bootstrap admins conhecidos (ADMIN_EMAILS) já resultam sempre em 'admin' mais
  // abaixo — sair aqui poupa a verificação de papel (perfil + 4 tabelas de
  // produtos), que só interessa para contas que não estão nesta lista.
  if (ADMIN_EMAILS.has(email)) {
    return { user: { id: user.id, email, role: 'admin' } };
  }

  // Atalho só pelo app_metadata (escrito pelo servidor) — o user_metadata é editável
  // pelo próprio utilizador e não pode decidir papéis de staff.
  let effectiveRole = user.app_metadata?.role;
  if (!effectiveRole || (effectiveRole !== 'admin' && effectiveRole !== 'manager' && effectiveRole !== 'reseller')) {
    try {
      effectiveRole = await resolveRoleForAuthUser(supabase, user);
    } catch {
      /* manter metadata */
    }
  }

  if (effectiveRole === 'admin') {
    return { user: { id: user.id, email, role: 'admin' } };
  }

  if (effectiveRole === 'reseller') {
    return { user: { id: user.id, email, role: 'reseller' } };
  }

  if (effectiveRole === 'manager') {
    return { user: { id: user.id, email, role: 'manager' } };
  }

  return STAFF_ACCESS_DENIED();
}

/**
 * Admin ou revendedor apenas — "manager" é explicitamente rejeitado (403). Rotas que fazem
 * sentido para uma conta "manager" com scope próprio devem usar
 * requireAdminResellerOrManager() em vez desta, caso a caso (ver AUDITORIA_PAINEL_PLANO_CORRECAO.md).
 */
export async function requireAdminOrReseller(): Promise<PanelAuthSuccess | PanelAuthFailure> {
  const result = await resolvePanelStaffAuth();
  if ('error' in result) return result;
  if (result.user.role === 'manager') {
    return STAFF_ACCESS_DENIED();
  }
  return { user: result.user as { id: string; email?: string; role: 'admin' | 'reseller' } };
}

/** Como requireAdminOrReseller(), mas também aceita "manager" — só para rotas já escopadas ao seu próprio site. */
export async function requireAdminResellerOrManager(): Promise<PanelStaffAuthSuccess | PanelAuthFailure> {
  return resolvePanelStaffAuth();
}

export type PanelBootstrapAuthSuccess = {
  user: {
    id: string;
    email?: string;
    role: 'admin' | 'manager' | 'reseller' | 'client';
  };
};

export async function requirePanelBootstrapAccess(): Promise<
  PanelBootstrapAuthSuccess | PanelAuthFailure
> {
  const supabase = await createClient();
  // Sem recurso ao getSession() quando o getUser() falha: isso aceitava justamente os
  // cookies que o servidor de auth acabara de recusar.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }),
    };
  }

  const email = (user.email || '').toLowerCase();

  // Bootstrap admins conhecidos (ADMIN_EMAILS) já resultam sempre em 'admin' mais
  // abaixo — sair aqui poupa a verificação de papel (perfil + 4 tabelas de
  // produtos), que só interessa para contas que não estão nesta lista.
  if (ADMIN_EMAILS.has(email)) {
    return { user: { id: user.id, email, role: 'admin' } };
  }

  let effectiveRole = user.app_metadata?.role;
  if (
    !effectiveRole ||
    (effectiveRole !== 'admin' &&
      effectiveRole !== 'manager' &&
      effectiveRole !== 'reseller' &&
      effectiveRole !== 'client')
  ) {
    try {
      effectiveRole = await resolveRoleForAuthUser(supabase, user);
    } catch {
      /* manter metadata */
    }
  }

  if (effectiveRole === 'client') {
    return { user: { id: user.id, email, role: 'client' } };
  }

  if (effectiveRole === 'manager') {
    return { user: { id: user.id, email, role: 'manager' } };
  }

  if (effectiveRole === 'admin') {
    return { user: { id: user.id, email, role: 'admin' } };
  }

  if (effectiveRole === 'reseller') {
    return { user: { id: user.id, email, role: 'reseller' } };
  }

  return {
    error: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }),
  };
}
