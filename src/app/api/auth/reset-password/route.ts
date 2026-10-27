import { NextRequest, NextResponse } from 'next/server';
import {
  formatPasswordResetClientError,
  requestPasswordResetEmail,
} from '@/lib/supabase-auth-email';
import { turnstileValido } from '@/lib/turnstile';
import { ipDoPedido, passouOLimite } from '@/lib/limite-pedidos';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body?.email || '').trim();

    // "Não sou um robô" (Turnstile da Cloudflare) do formulário de recuperação de palavra-passe (Silva, 27/10/2026).
    // Sem TURNSTILE_SECRET_KEY no servidor não verifica (ver turnstile.ts).
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    if (!(await turnstileValido(body?.turnstile, ip))) {
      return NextResponse.json({ error: 'A verificação de segurança falhou ou expirou. Confirme de novo que não é um robô.' }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: 'Indique o email.' }, { status: 400 });
    }

    // Limite por rede e por endereço: o "não sou um robô" trava programas, mas uma pessoa podia encher a caixa de outra
    // com e-mails de recuperação.
    if (passouOLimite(`reset-ip:${ipDoPedido(req)}`, 20, 10 * 60_000) || passouOLimite(`reset-email:${email.toLowerCase()}`, 3, 60 * 60_000)) {
      return NextResponse.json({ error: 'Demasiados pedidos. Tente novamente daqui a algum tempo.' }, { status: 429 });
    }

    await requestPasswordResetEmail(email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[auth/reset-password]', err);
    return NextResponse.json(
      { error: formatPasswordResetClientError(err) },
      { status: 500 },
    );
  }
}
