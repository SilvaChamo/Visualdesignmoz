// Autenticação de domínio na Brevo (Brevo code + DKIM real) — usado para
// que os e-mails enviados via Brevo passem DKIM/DMARC para cada domínio
// que entra no painel.
//
// Docs: https://developers.brevo.com/docs/domain-creation-and-management

import { getBrevoApiKey } from '@/lib/brevo-mail';

export type BrevoDnsRecord = {
  type: 'TXT' | 'CNAME';
  hostName: string; // relativo ao domínio, ex: 'mail._domainkey' ou '' (raiz)
  value: string;
  status: boolean; // já verificado pela Brevo?
};

export type BrevoDomainAuthResult = {
  ok: boolean;
  domainName: string;
  /** 1 ou 2 registos, consoante a Brevo devolva o DKIM antigo (TXT único)
   * ou o novo esquema de dois CNAME (dkim1Record/dkim2Record). */
  dkim: BrevoDnsRecord[];
  brevoCode?: BrevoDnsRecord;
  alreadyExisted: boolean;
  error?: string;
};

type BrevoDnsRecordRaw = { type: string; value: string; host_name: string; status: boolean };

type BrevoCreateDomainResponse = {
  id?: string;
  domain_name?: string;
  message?: string;
  dns_records?: {
    // Esquema antigo (domínios mais antigos) — um único TXT.
    dkim_record?: BrevoDnsRecordRaw;
    // Esquema actual (visto pela primeira vez 24 ago, domínios novos) —
    // dois CNAME. A Brevo devolve os dois campos sempre, mas dkim_record
    // vem a null quando está neste esquema novo.
    dkim1Record?: BrevoDnsRecordRaw;
    dkim2Record?: BrevoDnsRecordRaw;
    brevo_code?: BrevoDnsRecordRaw;
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

function toRecord(raw?: BrevoDnsRecordRaw): BrevoDnsRecord | undefined {
  if (!raw) return undefined;
  return {
    type: raw.type === 'CNAME' ? 'CNAME' : 'TXT',
    hostName: (raw.host_name || '').replace(/\.$/, ''),
    value: raw.value,
    status: Boolean(raw.status),
  };
}

function parseRecords(dns?: BrevoCreateDomainResponse['dns_records']) {
  // Esquema novo (dois CNAME) tem prioridade — é o que a Brevo devolve
  // para domínios criados agora. Só cai para o esquema antigo (um TXT)
  // se nenhum dos dois novos vier preenchido.
  const dual = [toRecord(dns?.dkim1Record), toRecord(dns?.dkim2Record)].filter(
    (r): r is BrevoDnsRecord => Boolean(r),
  );
  const dkim = dual.length > 0 ? dual : [toRecord(dns?.dkim_record)].filter((r): r is BrevoDnsRecord => Boolean(r));
  const brevoCode = toRecord(dns?.brevo_code);
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
    return { ok: false, domainName, dkim: [], alreadyExisted: false, error: 'BREVO_API_KEY não configurada' };
  }
  if (!domainName) {
    return { ok: false, domainName, dkim: [], alreadyExisted: false, error: 'Domínio vazio' };
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

    // Se já existir (mensagem de duplicado — a Brevo nem sempre usa 400 para
    // isto, por isso não filtramos por status code), vamos buscar a config
    // existente em vez de tratar como falha a sério.
    const errBody = await createRes.json().catch(() => ({}) as Record<string, unknown>);
    const msg = String((errBody as { message?: string }).message || '');
    const looksDuplicate = /already exist|duplicate|exists/i.test(msg);

    if (!looksDuplicate) {
      return {
        ok: false,
        domainName,
        dkim: [],
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
        dkim: [],
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
      dkim: [],
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

/**
 * Remove o domínio da lista de domínios autenticados da Brevo. Chamado
 * quando um domínio (ou a conta inteira dona dele) é eliminado no painel,
 * para não deixar lixo na conta da Brevo. 404 conta como sucesso (já não
 * existe lá, que é o resultado desejado).
 */
export async function deleteBrevoDomain(domain: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = getBrevoApiKey();
  const domainName = domain.trim().toLowerCase();
  if (!apiKey || !domainName) return { ok: false, error: 'Config em falta' };

  try {
    const res = await fetch(`${BREVO_API_BASE}/senders/domains/${encodeURIComponent(domainName)}`, {
      method: 'DELETE',
      headers: brevoHeaders(apiKey),
    });
    if (res.ok || res.status === 404) return { ok: true };
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    return { ok: false, error: String((body as { message?: string }).message || `HTTP ${res.status}`) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

/**
 * Cria o remetente principal (ex: geral@dominio.com) na Brevo para um
 * domínio novo. Chamar depois de ensureBrevoDomainAuth ter corrido — com o
 * domínio já autenticado (DKIM), a Brevo não pede confirmação manual por
 * clique no e-mail, fica logo verificado. Idempotente: 400 "already exists"
 * conta como sucesso.
 */
export async function ensureBrevoSender(
  email: string,
  name: string,
): Promise<{ ok: boolean; alreadyExisted: boolean; error?: string }> {
  const apiKey = getBrevoApiKey();
  const cleanEmail = email.trim().toLowerCase();
  if (!apiKey) return { ok: false, alreadyExisted: false, error: 'BREVO_API_KEY não configurada' };
  if (!cleanEmail.includes('@')) return { ok: false, alreadyExisted: false, error: 'Email inválido' };

  try {
    const res = await fetch(`${BREVO_API_BASE}/senders`, {
      method: 'POST',
      headers: brevoHeaders(apiKey),
      body: JSON.stringify({ email: cleanEmail, name }),
    });
    if (res.ok) return { ok: true, alreadyExisted: false };

    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    const typed = body as { message?: string; code?: string };
    const msg = String(typed.message || '');
    // A Brevo devolve 404 (não 400) com code "duplicate_parameter" para um
    // remetente já existente — confirmado empiricamente, não documentado.
    if (typed.code === 'duplicate_parameter' || /already exist|duplicate/i.test(msg)) {
      return { ok: true, alreadyExisted: true };
    }
    return { ok: false, alreadyExisted: false, error: msg || `HTTP ${res.status}` };
  } catch (error) {
    return {
      ok: false,
      alreadyExisted: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}
