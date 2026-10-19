import { NextResponse } from 'next/server';
import { requireAdminResellerOrManager } from '@/lib/panel-api-auth';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import { getResellerDaUsername } from '@/lib/directadmin-credentials';
import {
  loadResellerCredentialsByDaUsername,
  loadResellerCredentialsByUserId,
} from '@/lib/da-credential-store';
import { getProfileForAuthUser } from '@/lib/profile-db';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';

/** "Provisionada" não pode depender só de haver password DA guardada e
 * decifrável — uma conta já migrada para o Hestia nunca tem isso (de
 * propósito, ver `da-credential-store.ts`) mas está tão provisionada como
 * qualquer outra. Confirma directamente se o username existe no espelho do
 * servidor, seja qual for o fornecedor real. */
async function isProvisionedUsername(daUsername: string | null | undefined): Promise<boolean> {
  if (!daUsername) return false;
  const sb = getDaSyncAdmin();
  if (!sb) return false;
  const { data } = await sb.from('panel_users').select('username').eq('username', daUsername).maybeSingle();
  return Boolean(data?.username);
}

export async function GET() {
  const auth = await requireAdminResellerOrManager();
  if ('error' in auth) return auth.error;

  if (auth.user.role === 'reseller' || auth.user.role === 'manager') {
    const stored = auth.user.id ? await loadResellerCredentialsByUserId(auth.user.id) : null;
    // O username em si (ao contrário da password DA) não depende do
    // fornecedor — vem sempre do perfil, mesmo numa conta já no Hestia.
    const profile = auth.user.id ? await getProfileForAuthUser(getDaSyncAdmin()!, auth.user.id) : null;
    const daUsername =
      stored?.user ||
      profile?.da_username ||
      (await getResellerDaUsername({ id: auth.user.id, email: auth.user.email, role: 'reseller' }));

    return NextResponse.json({
      success: true,
      daUsername,
      daDomain: stored?.domain || profile?.da_domain || null,
      provisioned: Boolean(stored?.user) || (await isProvisionedUsername(daUsername)),
    });
  }

  const ctx = await resolvePanelDaContext(auth);
  if (ctx.impersonating) {
    const creds = await loadResellerCredentialsByDaUsername(ctx.impersonating);
    return NextResponse.json({
      success: true,
      daUsername: ctx.impersonating,
      daDomain: creds?.domain || null,
      provisioned: Boolean(creds) || (await isProvisionedUsername(ctx.impersonating)),
    });
  }

  return NextResponse.json({
    success: true,
    daUsername: process.env.DIRECTADMIN_USER || 'admin',
    daDomain: null,
    provisioned: true,
  });
}
