import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { EXISTING_ACCOUNT_MESSAGE, authUserExists } from '@/lib/conta-existe';
import { findProtectedEmailClaim, PROTECTED_EMAIL_MESSAGE } from '@/lib/protected-account-email';

export const dynamic = 'force-dynamic';

/** Limite de verificações por endereço (memória do processo): não serve para descobrir que e-mails têm conta */
const LIMITE = 20;
const JANELA_MS = 10 * 60_000;
const pedidos = new Map<string, number[]>();

function demasiados(ip: string): boolean {
  const agora = Date.now();
  const recentes = (pedidos.get(ip) || []).filter((t) => agora - t < JANELA_MS);
  recentes.push(agora);
  pedidos.set(ip, recentes);
  if (pedidos.size > 5000) for (const [k, v] of pedidos) if (!v.some((t) => agora - t < JANELA_MS)) pedidos.delete(k);
  return recentes.length > LIMITE;
}

/**
 * POST /api/auth/email-livre { email } — 1.º passo do registo (pedido do Silva, 13/10/2026): diz logo se o e-mail já tem
 * conta (ou não pode ser usado), antes de passar ao 2.º passo. O registo final volta a verificar (api/auth/register).
 * Responde { livre: true } ou { livre: false, erro }. Se o servidor de autenticação falhar, deixa seguir.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'desconhecido';
  if (demasiados(ip)) {
    return NextResponse.json({ livre: false, erro: 'Demasiadas verificações. Tente novamente daqui a alguns minutos.' }, { status: 429 });
  }
  const b = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = String(b.email || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ livre: false, erro: 'Escreva um e-mail válido.' }, { status: 400 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ livre: true });
  try {
    const admin = createAdminClient(url, serviceKey);
    if (await authUserExists(admin, email)) return NextResponse.json({ livre: false, erro: EXISTING_ACCOUNT_MESSAGE });
    if (await findProtectedEmailClaim(email)) return NextResponse.json({ livre: false, erro: PROTECTED_EMAIL_MESSAGE });
    return NextResponse.json({ livre: true });
  } catch (e) {
    console.error('[auth/email-livre] falha a verificar:', e);
    return NextResponse.json({ livre: true });
  }
}
