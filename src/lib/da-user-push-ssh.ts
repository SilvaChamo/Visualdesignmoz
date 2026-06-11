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
}): Promise<{ ok: boolean; error?: string }> {
  const fields: Record<string, string> = {
    action: 'single',
    user: params.userName,
  };
  if (params.email) fields.email = params.email;
  if (params.firstName) fields.name = params.firstName;
  if (params.lastName) fields.name2 = params.lastName;
  if (params.websitesLimit !== undefined && params.websitesLimit > 0) {
    fields.vdomains = String(params.websitesLimit);
  }
  if (params.emailsLimit !== undefined && params.emailsLimit > 0) {
    fields.nemails = String(params.emailsLimit);
  }
  return daPostViaSsh('CMD_API_MODIFY_USER', fields);
}
