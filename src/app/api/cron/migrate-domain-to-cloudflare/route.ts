import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createCloudflareZone, upsertCloudflareRecord } from '@/lib/cloudflare-dns';
import { provisionEmailAuthForDomain } from '@/lib/domain-email-auth';
import { getServerHost } from '@/lib/server-config';

const CRON_SECRET = process.env.CRON_SECRET || 'default-secret-change-in-production';
const ADMIN_EMAILS = ['admin@visualdesignmoz.com', 'silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com'];

/**
 * Migra UM domínio que ainda está só no DNS interno do DirectAdmin para uma
 * zona própria na Cloudflare, sem tocar no DNS actual (a zona DA continua
 * autoritativa até o registador ser apontado para os nameservers novos —
 * este endpoint só prepara, nunca corta o domínio ao vivo).
 *
 * Passos: cria a zona Cloudflare (idempotente) → aplica o "A" da raiz/www
 * (site) → reaproveita o mesmo `provisionEmailAuthForDomain` já usado no
 * resto da plataforma (MX/SPF/DMARC/DKIM via Brevo, idempotente — se o
 * domínio já estiver registado na Brevo, reencontra as mesmas chaves DKIM
 * em vez de gerar novas). Devolve os nameservers a apontar no registador.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = Boolean(user && ADMIN_EMAILS.includes(user.email || ''));
  if (!isAdmin && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const domain = (searchParams.get('domain') || '').trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ success: false, error: 'domain é obrigatório.' }, { status: 400 });
  }

  const zone = await createCloudflareZone(domain);
  if (!zone.ok) {
    return NextResponse.json({ success: false, error: zone.error }, { status: 502 });
  }

  const serverIp = getServerHost();
  const siteRecords = [];
  if (serverIp) {
    siteRecords.push(await upsertCloudflareRecord(zone.zoneId, domain, { type: 'A', name: '@', content: serverIp, ttl: 3600 }));
    siteRecords.push(await upsertCloudflareRecord(zone.zoneId, domain, { type: 'A', name: 'www', content: serverIp, ttl: 3600 }));
    siteRecords.push(await upsertCloudflareRecord(zone.zoneId, domain, { type: 'A', name: 'webmail', content: serverIp, ttl: 3600 }));
  }

  const emailAuth = await provisionEmailAuthForDomain(domain);

  return NextResponse.json({
    success: true,
    domain,
    zoneId: zone.zoneId,
    zoneAlreadyExisted: zone.alreadyExisted,
    nameServers: zone.nameServers,
    siteRecords,
    emailAuth,
  });
}
