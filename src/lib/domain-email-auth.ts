// Orquestrador único: aplica SPF, MX, DMARC (estáticos) + DKIM/brevo-code
// (obtidos em tempo real na Brevo) a um domínio recém-criado no DirectAdmin
// ou no Hestia.
//
// Ponto de entrada único chamado quando um domínio é adicionado no painel
// (ver directadmin-adapter.ts -> createWebsite; hestia-adapter.ts ->
// createAccount/addWebDomain) — para não haver domínios que passam por um
// caminho e ficam sem automação e outros por outro.

import { after } from 'next/server';
import { daAddDnsRecord } from '@/lib/da-dns-ops';
import { daPostViaSsh } from '@/lib/da-api-ssh';
import { resolveDirectAdminCredentials } from '@/lib/directadmin-credentials';
import { getDefaultEmailDnsRecords, type EmailDnsRecord } from '@/lib/email-dns-defaults';
import { ensureBrevoDomainAuth, triggerBrevoDomainVerification, deleteBrevoDomain } from '@/lib/brevo-domain-auth';
import { getServerHost } from '@/lib/server-config';
import { upsertMirrorDns, deleteMirrorSite } from '@/lib/panel-mirror-write';
import { scheduleDaSync } from '@/lib/da-sync-engine';
import { getProviderByUsername } from '@/lib/hosting-provider';
import {
  findCloudflareZoneId,
  upsertCloudflareRecord,
  deleteCloudflareEmailRecords,
} from '@/lib/cloudflare-dns';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Quem hospeda hoje um domínio sem zona própria na Cloudflare — só importa
 * para o "cai no DNS interno" abaixo (a maioria dos domínios reais tem zona
 * Cloudflare e nunca chega a precisar disto). Import dinâmico do
 * hosting-provider evita um ciclo estático com hestia-adapter.ts, que por
 * sua vez importa este ficheiro para disparar esta automação. */
async function resolveFallbackHostingProvider(
  domain: string,
): Promise<{ provider: 'hestia' | 'directadmin'; owner: string | null }> {
  const { resolveHostingOwner, hostingProvider } = await import('@/lib/hosting-resolver');
  const owner = await resolveHostingOwner(domain);
  if (hostingProvider === 'hestia') return { provider: 'hestia', owner };
  if (!owner) return { provider: 'directadmin', owner: null };
  return { provider: await getProviderByUsername(owner), owner };
}

/**
 * Aplica um registo de DNS de e-mail no sítio certo: se o domínio já tiver
 * zona própria na Cloudflare, aplica lá (é o que fica realmente visível
 * publicamente); caso contrário cai no DNS interno de quem hospeda o
 * domínio hoje — Hestia ou DirectAdmin — e só serve domínios cujos
 * nameservers ainda são ns1/ns2.visualdesignmoz.com.
 */
async function applyRecordAnyProvider(
  cleanDomain: string,
  cfZoneId: string | null,
  fallback: { provider: 'hestia' | 'directadmin'; owner: string | null } | null,
  creds: Awaited<ReturnType<typeof resolveDirectAdminCredentials>> | null,
  record: EmailDnsRecord,
): Promise<DnsAutomationRecordResult> {
  if (cfZoneId) {
    const r = await upsertCloudflareRecord(cfZoneId, cleanDomain, {
      type: record.type,
      name: record.name,
      content: record.type === 'MX' && record.priority != null ? record.value : record.value,
      ttl: record.ttl,
      priority: record.priority,
    });
    if (r.ok) {
      await upsertMirrorDns({
        domain: cleanDomain,
        name: record.name === '@' ? cleanDomain : record.name,
        type: record.type,
        value: record.value,
        ttl: record.ttl,
      });
    }
    return { name: r.name, type: r.type, ok: r.ok, error: r.error };
  }

  if (fallback?.provider === 'hestia') {
    if (!fallback.owner) {
      return { name: record.name, type: record.type, ok: false, error: 'Dono do domínio não identificado no Hestia' };
    }
    const hestiaAdapter = await import('@/lib/hestia-adapter');
    const result = await hestiaAdapter.addDnsRecord(
      fallback.owner,
      cleanDomain,
      record.name,
      record.type,
      record.value,
      record.ttl,
      record.priority != null ? String(record.priority) : undefined,
    );
    if (result.ok) {
      await upsertMirrorDns({
        domain: cleanDomain,
        name: record.name === '@' ? cleanDomain : record.name,
        type: record.type,
        value: record.value,
        ttl: record.ttl,
      });
    }
    return { name: record.name, type: record.type, ok: result.ok, error: result.error };
  }

  if (!creds) {
    return { name: record.name, type: record.type, ok: false, error: 'Sem credenciais DirectAdmin' };
  }
  return applyRecord(creds, cleanDomain, record);
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
 * chamado logo a seguir a criar o domínio no painel (DirectAdmin ou
 * Hestia) — best-effort: nunca lança erro, devolve sempre um relatório do
 * que passou/falhou para o painel poder mostrar um aviso se algo não ficou
 * 100%.
 */
export async function provisionEmailAuthForDomain(domain: string): Promise<DnsAutomationResult> {
  const cleanDomain = domain.trim().toLowerCase();
  const serverIp = getServerHost();
  const results: DnsAutomationRecordResult[] = [];

  let brevoOk = false;
  let brevoError: string | undefined;

  try {
    // Se o domínio já tiver zona própria na Cloudflare, os registos vão lá
    // (é o que fica visível publicamente); senão cai no DNS interno de quem
    // hospeda o domínio hoje (Hestia ou DirectAdmin).
    const cfZoneId = await findCloudflareZoneId(cleanDomain);
    const fallback = cfZoneId ? null : await resolveFallbackHostingProvider(cleanDomain);
    const creds =
      cfZoneId || fallback?.provider === 'hestia' ? null : await resolveDirectAdminCredentials('admin');

    // 1) SPF + MX + DMARC + A de mail/ftp/pop/smtp (não dependem de nenhuma
    //    chamada externa)
    const baseRecords = getDefaultEmailDnsRecords(cleanDomain, serverIp);
    for (const record of baseRecords) {
      results.push(await applyRecordAnyProvider(cleanDomain, cfZoneId, fallback, creds, record));
    }

    // 2) DKIM real + brevo-code (dependem da API da Brevo — falha aqui não
    //    deve impedir os registos estáticos de cima de terem sido aplicados)
    const brevoAuth = await ensureBrevoDomainAuth(cleanDomain);
    brevoOk = brevoAuth.ok;
    brevoError = brevoAuth.error;

    if (brevoAuth.ok) {
      for (const dkimRecord of brevoAuth.dkim) {
        results.push(
          await applyRecordAnyProvider(cleanDomain, cfZoneId, fallback, creds, {
            name: dkimRecord.hostName || '@',
            type: dkimRecord.type,
            value: dkimRecord.value,
            ttl: 3600,
          }),
        );
      }
      if (brevoAuth.brevoCode) {
        results.push(
          await applyRecordAnyProvider(cleanDomain, cfZoneId, fallback, creds, {
            name: brevoAuth.brevoCode.hostName || '@',
            type: 'TXT',
            value: brevoAuth.brevoCode.value,
            ttl: 3600,
          }),
        );
      }
    }

    if (fallback?.provider !== 'hestia') scheduleDaSync(30);

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
 * do domínio (DirectAdmin ou Hestia, consoante quem a hospeda) e retira o
 * domínio da Brevo. Chamado quando um domínio (ou a conta inteira dona
 * dele) é eliminado no painel — best effort, nunca lança erro, para não
 * travar a eliminação principal.
 */
export async function cleanupEmailAuthForDomain(domain: string): Promise<DnsCleanupResult> {
  const cleanDomain = domain.trim().toLowerCase();
  let dnsZoneDeleted = false;
  let brevoDeleted = false;
  let brevoError: string | undefined;

  try {
    const cfZoneId = await findCloudflareZoneId(cleanDomain);
    if (cfZoneId) {
      // Nunca apagar a zona inteira na Cloudflare — só os registos de email
      // que a automação criou (o resto da zona pode ter o site do cliente:
      // Shopify, Vercel, etc).
      const result = await deleteCloudflareEmailRecords(cleanDomain, cfZoneId);
      dnsZoneDeleted = result.ok;
    } else {
      const fallback = await resolveFallbackHostingProvider(cleanDomain);
      if (fallback.provider === 'hestia' && fallback.owner) {
        const hestiaAdapter = await import('@/lib/hestia-adapter');
        const result = await hestiaAdapter.deleteDnsZone(fallback.owner, cleanDomain);
        dnsZoneDeleted = result.ok;
      } else {
        const creds = await resolveDirectAdminCredentials('admin');
        const zoneResult = await daPostViaSsh(
          'CMD_API_DNS_CONTROL',
          { action: 'delete', domain: cleanDomain },
          creds,
        );
        dnsZoneDeleted = zoneResult.ok;
      }
    }
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

/**
 * Dispara a automação de SPF/DKIM/DMARC sem bloquear a resposta da criação
 * do domínio. Tenta usar after() (mantém o processo vivo em serverless até
 * a tarefa terminar); se after() não puder ser usado neste contexto (ex.
 * chamado fora de uma rota/pedido HTTP), cai para fire-and-forget simples
 * em vez de rebentar a criação do domínio. Usado por directadmin-adapter.ts
 * (createWebsite) e hestia-adapter.ts (createAccount/addWebDomain).
 */
export function runEmailDnsAutomation(domain: string): void {
  const task = () =>
    provisionEmailAuthForDomain(domain).catch((err) =>
      console.error('[email-dns-automation]', domain, err),
    );
  try {
    after(task);
  } catch (err) {
    console.error('[email-dns-automation] after() indisponível, a usar fallback:', err);
    void task();
  }
}

/** Mesma lógica de protecção que runEmailDnsAutomation, mas para a limpeza
 *  (zona DNS + domínio na Brevo) quando um domínio/conta é eliminado. */
export function runEmailDnsCleanup(domain: string): void {
  const task = () =>
    cleanupEmailAuthForDomain(domain).catch((err) =>
      console.error('[email-dns-cleanup]', domain, err),
    );
  try {
    after(task);
  } catch (err) {
    console.error('[email-dns-cleanup] after() indisponível, a usar fallback:', err);
    void task();
  }
}
