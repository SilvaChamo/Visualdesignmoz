import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const ADMIN_EMAILS = new Set([
  'admin@visualdesigne.com',
  'geral@visualdesigne.com',
  'suporte@visualdesigne.com',
  'silva.chamo@gmail.com',
]);

type PanelAuthSuccess = {
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
  const metadataRole = user.user_metadata?.role || user.app_metadata?.role;

  if (metadataRole === 'admin' || ADMIN_EMAILS.has(email)) {
    return { user: { id: user.id, email, role: 'admin' } };
  }

  if (metadataRole === 'reseller') {
    return { user: { id: user.id, email, role: 'reseller' } };
  }

  return {
    error: NextResponse.json({ error: 'Acesso restrito a administradores ou revendedores' }, { status: 403 }),
  };
}
