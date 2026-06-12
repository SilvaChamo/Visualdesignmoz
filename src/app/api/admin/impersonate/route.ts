import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { IMPERSONATE_COOKIE } from '@/lib/panel-api-context';
import { listMirrorUsers } from '@/lib/panel-mirror-read';
import { loadResellerCredentialsByDaUsername } from '@/lib/da-credential-store';
import { getProfileForAuthUser } from '@/lib/profile-db';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function isResellerAccount(acl?: string | null): boolean {
  return String(acl || '').toLowerCase() === 'reseller';
}

async function requireAdminOnly() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth;
  if (auth.user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Apenas administradores' }, { status: 403 }) };
  }
  return auth;
}

export async function GET() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  const store = await cookies();
  const daUsername = store.get(IMPERSONATE_COOKIE)?.value?.trim() || null;
  const active = auth.user.role === 'admin' && !!daUsername;

  return NextResponse.json({
    success: true,
    active,
    daUsername: active ? daUsername : null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminOnly();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  let userName = String(body.userName || '').trim().toLowerCase();

  if (!userName && body.userId && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const profile = await getProfileForAuthUser(admin, String(body.userId));
    userName = String(profile?.da_username || '').trim().toLowerCase();
  }

  if (!userName) {
    return NextResponse.json(
      { success: false, error: 'Conta revendedor sem utilizador DA ligado.' },
      { status: 400 },
    );
  }

  const users = await listMirrorUsers({ role: 'admin', userId: auth.user.id });
  const target = users.find((u) => u.userName.toLowerCase() === userName);
  if (!target || !isResellerAccount(target.acl || target.type)) {
    return NextResponse.json(
      { success: false, error: 'Conta revendedor não encontrada no espelho do servidor.' },
      { status: 404 },
    );
  }

  const creds = await loadResellerCredentialsByDaUsername(userName);
  if (!creds) {
    return NextResponse.json(
      {
        success: false,
        error: `Sem credenciais para "${userName}". Sincronize ou ligue a conta no servidor primeiro.`,
      },
      { status: 503 },
    );
  }

  const store = await cookies();
  store.set(IMPERSONATE_COOKIE, userName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });

  return NextResponse.json({
    success: true,
    daUsername: userName,
    redirect: '/revendedor',
  });
}

export async function DELETE() {
  const auth = await requireAdminOnly();
  if ('error' in auth) return auth.error;

  const store = await cookies();
  store.delete(IMPERSONATE_COOKIE);

  return NextResponse.json({ success: true, redirect: '/admin?section=clientes' });
}
