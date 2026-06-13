import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import { getResellerDaUsername } from '@/lib/directadmin-credentials';
import {
  loadResellerCredentialsByDaUsername,
  loadResellerCredentialsByUserId,
} from '@/lib/da-credential-store';

export async function GET() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  if (auth.user.role === 'reseller') {
    const stored = auth.user.id ? await loadResellerCredentialsByUserId(auth.user.id) : null;
    const daUsername = stored?.user || (await getResellerDaUsername(auth.user));

    return NextResponse.json({
      success: true,
      daUsername,
      daDomain: stored?.domain || null,
      provisioned: Boolean(stored?.user || daUsername),
    });
  }

  const ctx = await resolvePanelDaContext(auth);
  if (ctx.impersonating) {
    const creds = await loadResellerCredentialsByDaUsername(ctx.impersonating);
    return NextResponse.json({
      success: true,
      daUsername: ctx.impersonating,
      daDomain: creds?.domain || null,
      provisioned: Boolean(creds),
    });
  }

  return NextResponse.json({
    success: true,
    daUsername: process.env.DIRECTADMIN_USER || 'admin',
    daDomain: null,
    provisioned: true,
  });
}
