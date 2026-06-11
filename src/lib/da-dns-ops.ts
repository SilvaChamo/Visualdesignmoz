import { daPostViaSsh } from '@/lib/da-api-ssh';
import type { DirectAdminCredentials } from '@/lib/directadmin-credentials';

const SELECT_KEYS: Record<string, string> = {
  A: 'arecs0',
  AAAA: 'aaaarecs0',
  NS: 'nsrecs0',
  MX: 'mxrecs0',
  CNAME: 'cnamerecs0',
  PTR: 'ptrrecs0',
  TXT: 'txtrecs0',
  SRV: 'srvrecs0',
};

export function normalizeDnsNameForDa(name: string, domain: string): string {
  const n = (name || '').trim();
  if (!n || n === '@' || n === domain || n === `${domain}.`) {
    return domain.endsWith('.') ? domain : `${domain}.`;
  }
  if (n.endsWith('.')) return n;
  return n;
}

export function buildDnsCombined(name: string, value: string, domain: string): string {
  const n = normalizeDnsNameForDa(name, domain);
  return `name=${n}&value=${value}`;
}

export async function daAddDnsRecord(
  creds: DirectAdminCredentials,
  fields: { domain: string; name: string; type: string; value: string; ttl: number },
): Promise<{ ok: boolean; error?: string }> {
  return daPostViaSsh(
    'CMD_API_DNS_CONTROL',
    {
      action: 'add',
      domain: fields.domain,
      type: fields.type.toUpperCase(),
      name: normalizeDnsNameForDa(fields.name, fields.domain),
      value: fields.value,
      ttl: String(fields.ttl || 3600),
    },
    creds,
  );
}

export async function daDeleteDnsRecord(
  creds: DirectAdminCredentials,
  fields: { domain: string; name: string; type: string; value: string; combined?: string },
): Promise<{ ok: boolean; error?: string }> {
  const type = fields.type.toUpperCase();
  const selectKey = SELECT_KEYS[type] || 'arecs0';
  const combined = fields.combined || buildDnsCombined(fields.name, fields.value, fields.domain);
  return daPostViaSsh(
    'CMD_API_DNS_CONTROL',
    {
      action: 'select',
      domain: fields.domain,
      [selectKey]: combined,
    },
    creds,
  );
}
