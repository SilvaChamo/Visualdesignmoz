// Automação completa de um domínio comprado através do carrinho: regista o
// domínio a sério no registador (Dynadot), cria a zona na Cloudflare,
// aponta os nameservers do domínio para lá, aplica os registos de e-mail
// (MX/SPF/DMARC/DKIM/mail-ftp-pop-smtp — reaproveita domain-email-auth.ts,
// que já sabe usar a Cloudflare assim que a zona existir) e cria o
// remetente principal (geral@dominio) na Brevo.
//
// Chamado (best-effort, nunca deve travar o checkout) a partir de
// checkout-fulfillment.ts só para itens 'domain' do carrinho — domínios que
// o cliente já possuía e só está a apontar para cá passam por um caminho
// diferente (attach-email-domain), nunca por aqui.

import { dynadotAPI, checkAvailability, mapProfileToDynadotContact } from '@/lib/dynadot-adapter';
import { createCloudflareZone } from '@/lib/cloudflare-dns';
import { provisionEmailAuthForDomain, type DnsAutomationResult } from '@/lib/domain-email-auth';
import { ensureBrevoSender } from '@/lib/brevo-domain-auth';

export type DomainAutoProvisionStep = {
  step: 'registo' | 'zona-cloudflare' | 'nameservers' | 'dns-email' | 'remetente-brevo';
  ok: boolean;
  detail?: string;
  error?: string;
};

export type DomainAutoProvisionResult = {
  domain: string;
  ok: boolean;
  steps: DomainAutoProvisionStep[];
  emailDns?: DnsAutomationResult;
};

export async function autoProvisionPurchasedDomain(input: {
  domain: string;
  years?: number;
  profile: Record<string, unknown> | null;
  userEmail: string;
  displayName?: string;
}): Promise<DomainAutoProvisionResult> {
  const domain = input.domain.trim().toLowerCase();
  const years = Math.max(1, Math.round(input.years || 1));
  const steps: DomainAutoProvisionStep[] = [];

  // 1) Registar o domínio — idempotente: se já existir na nossa conta da
  //    Dynadot (ex: nova tentativa depois de uma falha a meio), salta o
  //    registo em vez de tentar comprar outra vez.
  const existing = await dynadotAPI.getDomainDetails(domain);
  if (existing.success) {
    steps.push({ step: 'registo', ok: true, detail: 'Domínio já estava registado (tentativa anterior ou registo directo).' });
  } else {
    const available = await checkAvailability(domain);
    if (!available.available) {
      steps.push({
        step: 'registo',
        ok: false,
        error: available.error || 'Domínio deixou de estar disponível — pode já ter sido registado por outra pessoa.',
      });
      return { domain, ok: false, steps };
    }

    const contact = await dynadotAPI.createContact(mapProfileToDynadotContact(input.profile, input.userEmail));
    if (!contact.success) {
      steps.push({ step: 'registo', ok: false, error: `Falha a criar contacto WHOIS: ${contact.error}` });
      return { domain, ok: false, steps };
    }

    const registered = await dynadotAPI.registerDomain(domain, contact.contactId, years, true);
    if (!registered.success) {
      steps.push({ step: 'registo', ok: false, error: registered.error });
      return { domain, ok: false, steps };
    }
    steps.push({ step: 'registo', ok: true, detail: registered.message });
  }

  // 2) Criar a zona na Cloudflare (idempotente: devolve a existente se já lá estiver)
  const zone = await createCloudflareZone(domain);
  if (!zone.ok) {
    steps.push({ step: 'zona-cloudflare', ok: false, error: zone.error });
    // sem zona não há nameservers nem DNS de e-mail com sentido — pára aqui,
    // mas o domínio já está registado (visível no painel para acção manual).
    return { domain, ok: false, steps };
  }
  steps.push({
    step: 'zona-cloudflare',
    ok: true,
    detail: zone.alreadyExisted ? 'Zona já existia' : `Zona criada (${zone.zoneId})`,
  });

  // 3) Apontar os nameservers do domínio para a Cloudflare
  if (zone.nameServers.length >= 2) {
    const ns = await dynadotAPI.setNameservers(domain, zone.nameServers);
    steps.push(
      ns.success
        ? { step: 'nameservers', ok: true, detail: ns.hosts.join(', ') }
        : { step: 'nameservers', ok: false, error: ns.error },
    );
  } else {
    steps.push({ step: 'nameservers', ok: false, error: 'Cloudflare não devolveu nameservers (zona já existia?)' });
  }

  // 4) DNS de e-mail — a mesma automação usada para domínios que os clientes
  //    já traziam de fora; agora encontra a zona que acabámos de criar.
  const emailDns = await provisionEmailAuthForDomain(domain);
  const emailDnsOk = emailDns.brevoOk && emailDns.records.every((r) => r.ok);
  steps.push({
    step: 'dns-email',
    ok: emailDnsOk,
    detail: `${emailDns.records.filter((r) => r.ok).length}/${emailDns.records.length} registos aplicados`,
    error: emailDnsOk
      ? undefined
      : [emailDns.brevoError, ...emailDns.records.filter((r) => !r.ok).map((r) => `${r.name} (${r.type}): ${r.error}`)]
          .filter(Boolean)
          .join('; '),
  });

  // 5) Remetente principal no Brevo (geral@dominio)
  const senderName = input.displayName?.trim() || domain;
  const sender = await ensureBrevoSender(`geral@${domain}`, senderName);
  steps.push(
    sender.ok
      ? { step: 'remetente-brevo', ok: true, detail: sender.alreadyExisted ? 'Já existia' : 'Criado' }
      : { step: 'remetente-brevo', ok: false, error: sender.error },
  );

  return { domain, ok: steps.every((s) => s.ok), steps, emailDns };
}
