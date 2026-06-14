import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-api-auth';
import { ensureResellerProvisioned } from '@/lib/reseller-auto-provision';
import { provisionResellerAccount } from '@/lib/reseller-provision';
import { upsertDownloadableCredentials } from '@/lib/panel-access-credentials';

/**
 * Cria ou liga revendedor — usa auto-provisionamento quando possível.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  try {
    const body = await req.json();
    const {
      email,
      password,
      nome,
      firstName,
      lastName,
      userName,
      domain,
      packageName,
      websitesLimit,
      emailsLimit,
      linkExisting,
      authUserId,
    } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email é obrigatório.' },
        { status: 400 },
      );
    }

    if (authUserId) {
      const result = await ensureResellerProvisioned({
        userId: authUserId,
        email,
        password,
        nome: nome || `${firstName || ''} ${lastName || ''}`.trim(),
        domain,
      });
      if (supabaseUrl && serviceKey && password) {
        const admin = createAdminClient(supabaseUrl, serviceKey);
        await upsertDownloadableCredentials(admin, {
          email: email.toLowerCase().trim(),
          password,
          userId: authUserId,
          role: 'reseller',
        });
      }
      return NextResponse.json({
        success: true,
        message: 'Revendedor provisionado automaticamente.',
        result,
      });
    }

    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password obrigatória para novo email sem conta Auth.' },
        { status: 400 },
      );
    }

    const result = await provisionResellerAccount({
      email,
      password,
      nome: nome || `${firstName || ''} ${lastName || ''}`.trim(),
      firstName,
      lastName,
      userName,
      domain,
      packageName,
      websitesLimit,
      emailsLimit,
      linkExisting: Boolean(linkExisting),
      authUserId,
    });

    if (supabaseUrl && serviceKey && result.authUserId && password) {
      const admin = createAdminClient(supabaseUrl, serviceKey);
      await upsertDownloadableCredentials(admin, {
        email: email.toLowerCase().trim(),
        password,
        userId: result.authUserId,
        role: 'reseller',
      });
    }

    return NextResponse.json({
      success: true,
      message: result.linkedExisting
        ? 'Revendedor ligado ao DirectAdmin.'
        : 'Revendedor criado no DirectAdmin e painel Visual Design.',
      result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao provisionar revendedor';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
