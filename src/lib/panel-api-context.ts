/**
 * Contexto API do painel — admin a impersonar revendedor (como no DirectAdmin).
 */

import { cookies } from 'next/headers';
import {
  getDirectAdminAPIForAuth,
  getDirectAdminAPIForDaUsername,
  type DirectAdminServerAPI,
} from '@/lib/directadmin-adapter';
import { getResellerDaUsername } from '@/lib/directadmin-credentials';
import type { MirrorScope } from '@/lib/panel-mirror-read';
import type { PanelStaffAuthSuccess } from '@/lib/panel-api-auth';

export const IMPERSONATE_COOKIE = 'vd_impersonate_reseller';

export async function readImpersonateDaUsername(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(IMPERSONATE_COOKIE)?.value?.trim();
  return value || null;
}

export type PanelDaContext = {
  daApi: DirectAdminServerAPI;
  mirrorScope: MirrorScope;
  impersonating: string | null;
  effectiveRole: 'admin' | 'reseller';
};

function hestiaDaApiStub(): DirectAdminServerAPI {
  return new Proxy({} as DirectAdminServerAPI, {
    get(_target, prop) {
      return async () => {
        throw new Error(`DirectAdmin.${String(prop)} não está disponível neste servidor (Hestia).`);
      };
    },
  });
}

export async function resolvePanelDaContext(
  auth: PanelStaffAuthSuccess,
  opts?: { ignoreImpersonation?: boolean },
): Promise<PanelDaContext> {
  const impersonating =
    auth.user.role === 'admin' && !opts?.ignoreImpersonation
      ? await readImpersonateDaUsername()
      : null;

  if ((process.env.DEFAULT_HOSTING_PROVIDER || '').trim().toLowerCase() === 'hestia') {
    const isReseller =
      Boolean(impersonating) ||
      auth.user.role === 'reseller' ||
      auth.user.role === 'manager' ||
      auth.user.role === 'profissional';
    const daUsername = impersonating || (isReseller ? await getResellerDaUsername({
      id: auth.user.id,
      email: auth.user.email,
      role: 'reseller',
    }) : undefined);
    return {
      daApi: hestiaDaApiStub(),
      mirrorScope: isReseller
        ? { role: 'reseller', userId: auth.user.id, daUsername: daUsername || undefined }
        : { role: 'admin', userId: auth.user.id },
      impersonating,
      effectiveRole: isReseller ? 'reseller' : 'admin',
    };
  }

  if (impersonating) {
    const daApi = await getDirectAdminAPIForDaUsername(impersonating);
    return {
      daApi,
      mirrorScope: { role: 'reseller', daUsername: impersonating },
      impersonating,
      effectiveRole: 'reseller',
    };
  }

  if (auth.user.role === 'reseller' || auth.user.role === 'manager' || auth.user.role === 'profissional') {
    // "manager" (conta colaborador) e "profissional" (comprador self-service)
    // usam exactamente o mesmo mecanismo de credenciais escopadas que um
    // revendedor — resolveDirectAdminCredentials() só distingue 'admin' de
    // "qualquer outra coisa", por isso ficam sempre limitados à sua própria
    // conta DA (loadResellerCredentialsByUserId por auth.user.id), nunca a admin real.
    const scopedAuth = { id: auth.user.id, email: auth.user.email, role: 'reseller' as const };
    const daUsername = await getResellerDaUsername(scopedAuth);
    const daApi = await getDirectAdminAPIForAuth(scopedAuth);
    return {
      daApi,
      mirrorScope: {
        role: 'reseller',
        userId: auth.user.id,
        daUsername: daUsername || undefined,
      },
      impersonating: null,
      effectiveRole: 'reseller',
    };
  }

  const daApi = await getDirectAdminAPIForAuth({ id: auth.user.id, email: auth.user.email, role: 'admin' });
  return {
    daApi,
    mirrorScope: { role: 'admin', userId: auth.user.id },
    impersonating: null,
    effectiveRole: 'admin',
  };
}
