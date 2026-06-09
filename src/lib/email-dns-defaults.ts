/**
 * DNS por defeito para email — receção via Brevo (sem porta 25 inbound Hetzner).
 * Envio: Exim smarthost Brevo (já no servidor).
 */

export const BREVO_INBOUND_MX = [
  { priority: 10, host: 'inbound1.sendinblue.com.' },
  { priority: 20, host: 'inbound2.sendinblue.com.' },
] as const;

export const BREVO_SPF_INCLUDE = 'include:spf.brevo.com';

export function buildEmailSpfRecord(serverIp?: string): string {
  const parts = ['v=spf1', BREVO_SPF_INCLUDE];
  if (serverIp?.trim()) parts.push(`ip4:${serverIp.trim()}`);
  parts.push('~all');
  return parts.join(' ');
}

export type EmailDnsRecord = {
  name: string;
  type: 'MX' | 'TXT' | 'A';
  value: string;
  ttl: number;
  priority?: number;
};

/** Registos MX+SPF aplicados ao criar conta de email ou domínio novo */
export function getDefaultEmailDnsRecords(
  domain: string,
  serverIp?: string,
): EmailDnsRecord[] {
  const spf = buildEmailSpfRecord(serverIp);
  return [
    ...BREVO_INBOUND_MX.map((mx) => ({
      name: '@',
      type: 'MX' as const,
      value: mx.host,
      ttl: 3600,
      priority: mx.priority,
    })),
    {
      name: '@',
      type: 'TXT' as const,
      value: spf,
      ttl: 3600,
    },
    {
      name: 'mail',
      type: 'A' as const,
      value: serverIp || '',
      ttl: 3600,
    },
  ].filter((r) => r.type !== 'A' || Boolean(r.value));
}

export const BREVO_INBOUND_WEBHOOK_PATH = '/api/webhook/brevo-inbound';
