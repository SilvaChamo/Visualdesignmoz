import { NextRequest, NextResponse } from 'next/server';
import { requireDaAccessForDomain } from '@/lib/panel-domain-access';
import { dynadotAPI, mapProfileToDynadotContact } from '@/lib/dynadot-adapter';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { profileAuthOrFilter } from '@/lib/profile-db';

export type WhoisPreview = {
  name: string;
  email: string;
  telefone: string;
  morada: string;
  cidade: string;
  complete: boolean;
};

async function loadWhoisPreview(domain: string, fallbackUserId: string): Promise<WhoisPreview | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data: renewal } = await admin
    .from('domain_renewals')
    .select('user_id')
    .eq('domain_name', domain)
    .maybeSingle();
  const userId = renewal?.user_id || fallbackUserId;

  const { data: profile } = await admin
    .from('profiles')
    .select('name, telefone, morada, cidade, email')
    .or(profileAuthOrFilter(userId))
    .maybeSingle();

  let email = String(profile?.email || '');
  if (!email) {
    const { data } = await admin.auth.admin.getUserById(userId);
    email = data.user?.email || '';
  }

  const telefone = String(profile?.telefone || '').trim();
  const morada = String(profile?.morada || '').trim();
  const cidade = String(profile?.cidade || '').trim();
  return {
    name: String(profile?.name || '').trim(),
    email,
    telefone,
    morada,
    cidade,
    complete: Boolean(telefone && morada && cidade),
  };
}

/** O que o servidor sabe de um domínio que a Dynadot não conhece (registado noutro registador): o registo de renovações da Visual Design
 *  (datas e renovação automática) e a consulta pública RDAP (datas reais, trava de transferência, nameservers). Nunca inventa: o que
 *  nenhuma das duas fontes diz fica `null`/vazio. */
export type RegistoLocal = {
  registrationDate: string;
  expireDate: string;
  autoRenew: boolean | null;
  isLocked: boolean | null;
  nameservers: string[];
  /** há uma linha no registo de renovações (a da conta, se o pedido vem de um cliente) */
  comRegisto: boolean;
};

async function lerRdap(domain: string): Promise<Pick<RegistoLocal, 'registrationDate' | 'expireDate' | 'isLocked' | 'nameservers'> | null> {
  try {
    const r = await fetch('https://rdap.org/domain/' + encodeURIComponent(domain), {
      headers: { Accept: 'application/rdap+json' },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      events?: { eventAction?: string; eventDate?: string }[];
      status?: string[];
      nameservers?: { ldhName?: string }[];
    };
    const data = (acao: string) => {
      const e = (j.events || []).find((x) => x.eventAction === acao && x.eventDate);
      return e?.eventDate ? e.eventDate.slice(0, 10) : '';
    };
    const estados = (j.status || []).map((x) => x.toLowerCase());
    return {
      registrationDate: data('registration'),
      expireDate: data('expiration'),
      isLocked: estados.length ? estados.some((x) => x === 'client transfer prohibited' || x === 'server transfer prohibited') : null,
      nameservers: (j.nameservers || []).map((n) => String(n.ldhName || '').toLowerCase()).filter(Boolean),
    };
  } catch {
    return null;
  }
}

/** `donoId`: para uma conta de cliente só conta o registo de renovações dela (o acesso ao domínio pode vir só da hospedagem, e a linha ser de outra
 *  conta); a equipa (admin, revenda, gestor, profissional) já vê qualquer domínio nesta rota e fica sem filtro. */
async function loadRegistoLocal(domain: string, donoId?: string): Promise<RegistoLocal | null> {
  const admin = getSupabaseAdmin();
  const [renovacao, rdap] = await Promise.all([
    admin
      ? (() => {
          const q = admin.from('domain_renewals').select('registration_date, expiration_date, auto_renew').eq('domain_name', domain);
          return (donoId ? q.eq('user_id', donoId) : q)
            .order('expiration_date', { ascending: false })
            .limit(1)
            .then((r) => r.data?.[0] || null);
        })()
      : Promise.resolve(null),
    lerRdap(domain),
  ]);
  if (!renovacao && !rdap) return null;
  // as datas vêm do registo público (é o que vale no registador); na falta dele, do registo de renovações
  return {
    registrationDate: rdap?.registrationDate || String(renovacao?.registration_date || ''),
    expireDate: rdap?.expireDate || String(renovacao?.expiration_date || ''),
    autoRenew: typeof renovacao?.auto_renew === 'boolean' ? renovacao.auto_renew : null,
    isLocked: rdap?.isLocked ?? null,
    nameservers: rdap?.nameservers || [],
    comRegisto: !!renovacao,
  };
}

/** Detalhes e acções de gestão de domínio no registador (Dynadot). */
export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get('domain')?.trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ success: false, error: 'Domínio obrigatório' }, { status: 400 });
  }

  const auth = await requireDaAccessForDomain(domain);
  if ('error' in auth) return auth.error;

  const [result, dnssec, contactPreview] = await Promise.all([
    dynadotAPI.getDomainDetails(domain),
    dynadotAPI.getDnssecStatus(domain),
    loadWhoisPreview(domain, auth.user.id),
  ]);
  if (!result.success) {
    // domínio registado noutro registador: o painel mostra o que o servidor sabe dele (só leitura) em vez de "—"
    const cliente = auth.user.role === 'client';
    const local = await loadRegistoLocal(domain, cliente ? auth.user.id : undefined);
    // o perfil que o contactPreview lê é o da linha do registo de renovações (de qualquer conta): a um cliente sem linha própria não se mostra
    return NextResponse.json({ success: false, error: result.error, local, contactPreview: cliente && !local?.comRegisto ? null : contactPreview }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    domain,
    isLocked: result.isLocked,
    autoRenew: result.autoRenew,
    expireDate: result.expireDate,
    registrationDate: result.registrationDate,
    status: result.status,
    nameservers: result.nameservers,
    privacyEnabled: result.privacyEnabled,
    dnssecEnabled: dnssec.success ? dnssec.enabled : null,
    contactPreview,
  });
}

export async function POST(request: NextRequest) {
  let body: { domain?: string; action?: string; isEnabled?: boolean; nameservers?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const domain = body.domain?.trim().toLowerCase();
  const action = body.action?.trim();

  if (!domain || !action) {
    return NextResponse.json({ success: false, error: 'Domínio e acção obrigatórios' }, { status: 400 });
  }

  // unlock/auth-code/set-nameservers dão acesso efectivo a levar o domínio para outro
  // registador ou reapontá-lo para outro lado — só quem realmente é dono do domínio
  // (staff, ou o cliente confirmado dono via requireDaAccessForDomain) pode chamar isto.
  const auth = await requireDaAccessForDomain(domain);
  if ('error' in auth) return auth.error;

  if (action === 'unlock' || action === 'lock') {
    const result = await dynadotAPI.setTransferLock(domain, action === 'lock');
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      isLocked: result.isLocked,
      message: action === 'lock' ? 'Domínio bloqueado para transferência.' : 'Bloqueio de transferência removido.',
    });
  }

  if (action === 'auth-code') {
    const result = await dynadotAPI.getTransferAuthCode(domain);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      authCode: result.authCode,
      message: 'Código de transferência obtido.',
    });
  }

  if (action === 'set-nameservers') {
    const nameservers = Array.isArray(body.nameservers)
      ? body.nameservers.map((n) => String(n).trim()).filter(Boolean)
      : [];
    if (nameservers.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Indique pelo menos 2 nameservers.' },
        { status: 400 },
      );
    }
    const result = await dynadotAPI.setNameservers(domain, nameservers);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      nameservers: result.hosts,
      message: 'Nameservers actualizados.',
    });
  }

  if (action === 'autorenew') {
    if (typeof body.isEnabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'isEnabled obrigatório' }, { status: 400 });
    }
    const result = await dynadotAPI.setAutoRenew(domain, body.isEnabled);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      autoRenew: result.isEnabled,
      message: result.isEnabled ? 'Renovação automática activada.' : 'Renovação automática desactivada.',
    });
  }

  if (action === 'set-contacts') {
    const preview = await loadWhoisPreview(domain, auth.user.id);
    if (!preview?.complete) {
      return NextResponse.json({
        success: false,
        error: 'O perfil do dono ainda não tem telefone, morada e cidade — complete-os em Conta antes de actualizar o WHOIS.',
        contactPreview: preview,
      }, { status: 400 });
    }
    const contact = await dynadotAPI.createContact(mapProfileToDynadotContact({
      name: preview.name,
      telefone: preview.telefone,
      morada: preview.morada,
      cidade: preview.cidade,
    }, preview.email));
    if (!contact.success) {
      return NextResponse.json({ success: false, error: contact.error || 'Falha a criar contacto WHOIS' }, { status: 400 });
    }
    const applied = await dynadotAPI.setDomainContacts(domain, contact.contactId);
    if (!applied.success) {
      return NextResponse.json({ success: false, error: applied.error || 'Falha a aplicar o contacto ao domínio' }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      contactPreview: preview,
      message: 'Dados de contacto WHOIS actualizados no registador.',
    });
  }

  return NextResponse.json({ success: false, error: 'Acção desconhecida' }, { status: 400 });
}
