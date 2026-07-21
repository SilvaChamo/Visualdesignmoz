/**
 * DNS por defeito para email — recepção via Brevo (sem porta 25 inbound Hetzner).
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

/**
 * DMARC recomendado pela Brevo: começa em modo "monitor" (p=none) para não
 * arriscar bloquear email legítimo logo no dia 1 — dá para apertar para
 * quarantine/reject mais tarde, depois de confirmado que SPF/DKIM passam.
 * O endereço rua é o da Brevo (recebem e resumem os relatórios).
 */
export function buildDmarcRecord(): string {
  return 'v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com; fo=1';
}

/** Registos MX+SPF+DMARC aplicados ao criar conta de email ou domínio novo.
 *  Não inclui DKIM — esse vem da API da Brevo (ver brevo-domain-auth.ts),
 *  porque a chave é gerada por domínio do lado da Brevo. */
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
      name: '_dmarc',
      type: 'TXT' as const,
      value: buildDmarcRecord(),
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
