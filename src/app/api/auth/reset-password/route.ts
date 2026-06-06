import { NextRequest, NextResponse } from 'next/server';
import {
  formatPasswordResetClientError,
  requestPasswordResetEmail,
} from '@/lib/supabase-auth-email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body?.email || '').trim();

    if (!email) {
      return NextResponse.json({ error: 'Indique o email.' }, { status: 400 });
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
