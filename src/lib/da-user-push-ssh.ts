/**
 * Aplica alterações de conta no servidor via SSH (localhost — evita IP blacklist).
 */

import { daPostViaSsh } from '@/lib/da-api-ssh';

export async function pushUserEditToServer(params: {
  userName: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  websitesLimit?: number;
  emailsLimit?: number;
  packageName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const fields: Record<string, string> = {
    action: 'single',
    user: params.userName,
  };
  if (params.email) fields.email = params.email;
  if (params.firstName !== undefined) fields.name = params.firstName;
  if (params.lastName !== undefined) fields.name2 = params.lastName;
  if (params.websitesLimit !== undefined) {
    fields.vdomains = String(Math.max(0, Number(params.websitesLimit) || 0));
  }
  if (params.emailsLimit !== undefined) {
    fields.nemails = String(Math.max(0, Number(params.emailsLimit) || 0));
  }
  if (params.packageName !== undefined) fields.package = String(params.packageName || '').trim();
  return daPostViaSsh('CMD_API_MODIFY_USER', fields);
}
