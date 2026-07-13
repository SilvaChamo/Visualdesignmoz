// Orquestrador único: aplica SPF, MX, DMARC (estáticos) + DKIM/brevo-code
// (obtidos em tempo real na Brevo) a um domínio recém-criado no DirectAdmin.
//
// Ponto de entrada único chamado quando um domínio é adicionado no painel
// (ver directadmin-adapter.ts -> createWebsite) — para não haver domínios
// que passam por um caminho e ficam sem automação e outros por outro.

import { daAddDnsRecord } from '@/lib/da-dns-ops';
import { daPostViaSsh } from '@/lib/da-api-ssh';
import { resolveDirectAdminCredentials } from '@/lib/directadmin-credentials';
import { getDefaultEmailDnsRecords, type EmailDnsRecord } from '@/lib/email-dns-defaults';
import { ensureBrevoDomainAuth, triggerBrevoDomainVerification, deleteBrevoDomain } from '@/lib/brevo-domain-auth';
import { getServerHost } from '@/lib/server-config';
import { upsertMirrorDns, deleteMirrorSite } from '@/lib/panel-mirror-write';
import { scheduleDaSync } from '@/lib/da-sync-engine';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type DnsAutomationRecordResult = {
  name: string;
  type: string;
  ok: boolean;
  error?: string;
};

export type DnsAutomationResult = {
  domain: string;
  brevoOk: boolean;
  brevoError?: string;
  records: DnsAutomationRecordResult[];
  /** true = a Brevo já confirmou o domínio como autenticado */
  verified: boolean;
};

async function applyRecord(
  creds: Awaited<ReturnType<typeof resolveDirectAdminCredentials>>,
  domain: string,
  record: EmailDnsRecord,
): Promise<DnsAutomationRecordResult> {
  const value =
    record.type === 'MX' && record.priority != null
      ? `${record.priority} ${record.value}`
      : record.value;

  const result = await daAddDnsRecord(creds, {
    domain,
    name: record.name,
    type: record.type,
    value,
    ttl: record.ttl,
  });

  if (result.ok) {
    await upsertMirrorDns({
      domain,
      name: record.name === '@' ? domain : record.name,
      type: record.type,
      value,
      ttl: record.ttl,
    });
  }

  return { name: record.name, type: record.type, ok: result.ok, error: result.error };
}

/**
 * Aplica SPF + MX + DMARC + DKIM (Brevo) a um domínio. Feito para ser
 * chamado logo a seguir a criar o domínio no DirectAdmin — best-effort:
 * nunca lança erro, devolve sempre um relatório do que passou/falhou para
 * o painel poder mostrar um aviso se algo não ficou 100%.
 */
export async function provisionEmailAuthForDomain(domain: string): Promise<DnsAutomationResult> {
  const cleanDomain = domain.trim().toLowerCase();
  const serverIp = getServerHost();
  const results: DnsAutomationRecordResult[] = [];

  let brevoOk = false;
  let brevoError: string | undefined;

  try {
    const creds = await resolveDirectAdminCredentials('admin');

    // 1) SPF + MX inbound + DMARC (não dependem de nenhuma chamada externa)
    const baseRecords = getDefaultEmailDnsRecords(cleanDomain, serverIp).filter(
      (r) => r.type !== 'A', // o A/www já é tratado na criação do website em si
    );
    for (const record of baseRecords) {
      results.push(await applyRecord(creds, cleanDomain, record));
    }

    // 2) DKIM real + brevo-code (dependem da API da Brevo — falha aqui não
    //    deve impedir os registos estáticos de cima de terem sido aplicados)
    const brevoAuth = await ensureBrevoDomainAuth(cleanDomain);
    brevoOk = brevoAuth.ok;
    brevoError = brevoAuth.error;

    if (brevoAuth.ok) {
      if (brevoAuth.dkim) {
        results.push(
          await applyRecord(creds, cleanDomain, {
            name: brevoAuth.dkim.hostName || '@',
            type: 'TXT',
            value: brevoAuth.dkim.value,
            ttl: 3600,
          }),
        );
      }
      if (brevoAuth.brevoCode) {
        results.push(
          await applyRecord(creds, cleanDomain, {
            name: brevoAuth.brevoCode.hostName || '@',
            type: 'TXT',
            value: brevoAuth.brevoCode.value,
            ttl: 3600,
          }),
        );
      }
    }

    scheduleDaSync(30);

    // 3) Confirmar a autenticação junto da Brevo. Costuma ser quase
    //    instantâneo, mas o DNS pode ainda não ter propagado — por isso
    //    tentamos algumas vezes com pequenas pausas antes de desistir.
    let verified = false;
    if (brevoOk) {
      const delaysMs = [3000, 6000, 12000];
      for (const delay of delaysMs) {
        await sleep(delay);
        const attempt = await triggerBrevoDomainVerification(cleanDomain);
        if (attempt.ok) {
          verified = true;
          break;
        }
      }
    }

    return { domain: cleanDomain, brevoOk, brevoError, records: results, verified };
  } catch (error) {
    brevoError = brevoError || (error instanceof Error ? error.message : 'Erro desconhecido');
  }

  return { domain: cleanDomain, brevoOk, brevoError, records: results, verified: false };
}

export type DnsCleanupResult = {
  domain: string;
  dnsZoneDeleted: boolean;
  brevoDeleted: boolean;
  brevoError?: string;
};

/**
 * Faz o inverso do provisionEmailAuthForDomain: remove a zona DNS inteira
 * do domínio no DirectAdmin e retira o domínio da Brevo. Chamado quando um
 * domínio (ou a conta inteira dona dele) é eliminado no painel — best
 * effort, nunca lança erro, para não travar a eliminação principal.
 */
export async function cleanupEmailAuthForDomain(domain: string): Promise<DnsCleanupResult> {
  const cleanDomain = domain.trim().toLowerCase();
  let dnsZoneDeleted = false;
  let brevoDeleted = false;
  let brevoError: string | undefined;

  try {
    const creds = await resolveDirectAdminCredentials('admin');
    const zoneResult = await daPostViaSsh(
      'CMD_API_DNS_CONTROL',
      { action: 'delete', domain: cleanDomain },
      creds,
    );
    dnsZoneDeleted = zoneResult.ok;
  } catch (error) {
    console.error('[email-dns-cleanup] falha a apagar zona DNS', cleanDomain, error);
  }

  try {
    const brevo = await deleteBrevoDomain(cleanDomain);
    brevoDeleted = brevo.ok;
    brevoError = brevo.error;
  } catch (error) {
    brevoError = error instanceof Error ? error.message : 'Erro desconhecido';
  }

  try {
    await deleteMirrorSite(cleanDomain);
  } catch (error) {
    console.error('[email-dns-cleanup] falha a limpar espelho local', cleanDomain, error);
  }

  scheduleDaSync(30);

  return { domain: cleanDomain, dnsZoneDeleted, brevoDeleted, brevoError };
}
