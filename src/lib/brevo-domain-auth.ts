// Autenticação de domínio na Brevo (Brevo code + DKIM real) — usado para
// que os e-mails enviados via Brevo passem DKIM/DMARC para cada domínio
// que entra no painel.
//
// Docs: https://developers.brevo.com/docs/domain-creation-and-management

import { getBrevoApiKey } from '@/lib/brevo-mail';

export type BrevoDnsRecord = {
  type: 'TXT';
  hostName: string; // relativo ao domínio, ex: 'mail._domainkey' ou '' (raiz)
  value: string;
  status: boolean; // já verificado pela Brevo?
};

export type BrevoDomainAuthResult = {
  ok: boolean;
  domainName: string;
  dkim?: BrevoDnsRecord;
  brevoCode?: BrevoDnsRecord;
  alreadyExisted: boolean;
  error?: string;
};

type BrevoCreateDomainResponse = {
  id?: string;
  domain_name?: string;
  message?: string;
  dns_records?: {
    dkim_record?: { type: string; value: string; host_name: string; status: boolean };
    brevo_code?: { type: string; value: string; host_name: string; status: boolean };
  };
};

type BrevoDomainConfigResponse = {
  domain_name?: string;
  dns_records?: BrevoCreateDomainResponse['dns_records'];
};

const BREVO_API_BASE = 'https://api.brevo.com/v3';

function brevoHeaders(apiKey: string) {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    'api-key': apiKey,
  };
}

function parseRecords(dns?: BrevoCreateDomainResponse['dns_records']) {
  const dkim = dns?.dkim_record
    ? {
        type: 'TXT' as const,
        hostName: (dns.dkim_record.host_name || '').replace(/\.$/, ''),
        value: dns.dkim_record.value,
        status: Boolean(dns.dkim_record.status),
      }
    : undefined;
  const brevoCode = dns?.brevo_code
    ? {
        type: 'TXT' as const,
        hostName: (dns.brevo_code.host_name || '').replace(/\.$/, ''),
        value: dns.brevo_code.value,
        status: Boolean(dns.brevo_code.status),
      }
    : undefined;
  return { dkim, brevoCode };
}

/**
 * Garante que o domínio existe na Brevo e devolve os registos DNS
 * (DKIM + brevo-code) necessários para autenticação. Idempotente:
 * se o domínio já existir na Brevo, vai buscar a configuração existente
 * em vez de falhar.
 */
export async function ensureBrevoDomainAuth(domain: string): Promise<BrevoDomainAuthResult> {
  const apiKey = getBrevoApiKey();
  const domainName = domain.trim().toLowerCase();

  if (!apiKey) {
    return { ok: false, domainName, alreadyExisted: false, error: 'BREVO_API_KEY não configurada' };
  }
  if (!domainName) {
    return { ok: false, domainName, alreadyExisted: false, error: 'Domínio vazio' };
  }

  try {
    const createRes = await fetch(`${BREVO_API_BASE}/senders/domains`, {
      method: 'POST',
      headers: brevoHeaders(apiKey),
      body: JSON.stringify({ name: domainName }),
    });

    if (createRes.ok) {
      const data = (await createRes.json()) as BrevoCreateDomainResponse;
      const { dkim, brevoCode } = parseRecords(data.dns_records);
      return { ok: true, domainName, dkim, brevoCode, alreadyExisted: false };
    }

    // Se já existir (400 com mensagem de duplicado), vamos buscar a config existente
    const errBody = await createRes.json().catch(() => ({}) as Record<string, unknown>);
    const msg = String((errBody as { message?: string }).message || '');
    const looksDuplicate =
      createRes.status === 400 && /already exist|duplicate|exists/i.test(msg);

    if (!looksDuplicate) {
      return {
        ok: false,
        domainName,
        alreadyExisted: false,
        error: msg || `Brevo respondeu ${createRes.status} ao criar domínio`,
      };
    }

    const getRes = await fetch(`${BREVO_API_BASE}/senders/domains/${encodeURIComponent(domainName)}`, {
      method: 'GET',
      headers: brevoHeaders(apiKey),
    });
    if (!getRes.ok) {
      return {
        ok: false,
        domainName,
        alreadyExisted: true,
        error: `Domínio já existe na Brevo mas não foi possível ler config (HTTP ${getRes.status})`,
      };
    }
    const existing = (await getRes.json()) as BrevoDomainConfigResponse;
    const { dkim, brevoCode } = parseRecords(existing.dns_records);
    return { ok: true, domainName, dkim, brevoCode, alreadyExisted: true };
  } catch (error) {
    return {
      ok: false,
      domainName,
      alreadyExisted: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao contactar Brevo',
    };
  }
}

/**
 * Pede à Brevo para (re)verificar a autenticação do domínio depois dos
 * registos DNS terem sido publicados. Não é bloqueante — a Brevo pode
 * demorar até 48h a confirmar propagação, por isso os erros aqui são
 * só informativos.
 */
export async function triggerBrevoDomainVerification(domain: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = getBrevoApiKey();
  const domainName = domain.trim().toLowerCase();
  if (!apiKey || !domainName) return { ok: false, error: 'Config em falta' };

  try {
    const res = await fetch(
      `${BREVO_API_BASE}/senders/domains/${encodeURIComponent(domainName)}/authenticate`,
      { method: 'PUT', headers: brevoHeaders(apiKey) },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as Record<string, unknown>);
      return { ok: false, error: String((body as { message?: string }).message || `HTTP ${res.status}`) };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}
