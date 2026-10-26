/**
 * DNS por defeito para email — recepção direta no Hetzner (porta 25 aberta,
 * o Exim/DirectAdmin do servidor recebe o correio). Envio: Exim smarthost
 * Brevo (já configurado no servidor) — por isso o SPF inclui a Brevo mesmo
 * a receção sendo local.
 */

export const BREVO_SPF_INCLUDE = 'include:spf.brevo.com';

export function buildEmailSpfRecord(serverIp?: string): string {
  const parts = ['v=spf1', BREVO_SPF_INCLUDE];
  if (serverIp?.trim()) parts.push(`ip4:${serverIp.trim()}`);
  parts.push('~all');
  return parts.join(' ');
}

export type EmailDnsRecord = {
  name: string;
  type: 'MX' | 'TXT' | 'A' | 'CNAME';
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

/** Registos MX+SPF+DMARC+A aplicados ao criar conta de email ou domínio novo.
 *  Não inclui DKIM — esse vem da API da Brevo (ver brevo-domain-auth.ts),
 *  porque a chave é gerada por domínio do lado da Brevo.
 *  MX aponta para mail.<dominio> no próprio servidor (receção direta, porta
 *  25) — o envio continua a sair pela Brevo (smarthost), daí o SPF incluir
 *  a Brevo mesmo com receção local. */
export function getDefaultEmailDnsRecords(
  domain: string,
  serverIp?: string,
): EmailDnsRecord[] {
  const spf = buildEmailSpfRecord(serverIp);
  const cleanDomain = domain.replace(/\.$/, '');
  return [
    {
      name: '@',
      type: 'MX' as const,
      value: `mail.${cleanDomain}.`,
      ttl: 3600,
      priority: 10,
    },
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
    {
      name: 'ftp',
      type: 'A' as const,
      value: serverIp || '',
      ttl: 3600,
    },
    {
      name: 'pop',
      type: 'A' as const,
      value: serverIp || '',
      ttl: 3600,
    },
    {
      name: 'smtp',
      type: 'A' as const,
      value: serverIp || '',
      ttl: 3600,
    },
    // webmail.<domínio>: o Hestia exige-o no DNS para emitir o certificado de e-mail (v-add-letsencrypt-domain … yes); sem ele recusa
    // ("DNS record for webmail.… doesn't exist") e o certificado de e-mail nunca renova sozinho (Silva, 26/10/2026)
    {
      name: 'webmail',
      type: 'A' as const,
      value: serverIp || '',
      ttl: 3600,
    },
  ].filter((r) => r.type !== 'A' || Boolean(r.value));
}
