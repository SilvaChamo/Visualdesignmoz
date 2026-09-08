import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { CatalogCartItem } from '@/lib/package-catalog';
import { generateProvisionerPassword } from '@/lib/reseller-auto-provision';
import { sanitizeDaUsername } from '@/lib/reseller-provision';
import { encryptDaSecret } from '@/lib/da-credential-store';
import { upsertPanelAuthAccount } from '@/lib/panel-auth-accounts';
import { upsertMirrorUser, upsertMirrorSite } from '@/lib/panel-mirror-write';
import { provisionPanelAccountToServer } from '@/lib/panel-server-provision';
import { getAdminDirectAdminAPI } from '@/lib/directadmin-adapter';
import { listPackages as listHestiaPackages } from '@/lib/hestia-adapter';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { autoProvisionPurchasedDomain } from '@/lib/domain-purchase-provision';
import { requiresManualRegistration } from '@/lib/domain-registration-support';
import { after } from 'next/server';
import { getProfileForAuthUser, saveProfileForAuthUser } from '@/lib/profile-db';

// Pacote dedicado por plano — tem de corresponder aos `defaultPackageName` de
// HOSTING_PLAN_PRESETS em reseller-package-form.ts, que é o que a secção
// "Pacotes" do admin cria de facto no DirectAdmin.
const HOSTING_PLAN_PACKAGE_NAMES: Record<string, string> = {
  'hosting-basico': 'VD-Host-Basico',
  'hosting-pro': 'VD-Host-Pro',
  'hosting-business': 'VD-Host-Business',
  'hosting-enterprise': 'VD-Host-Enterprise',
};

// Pacote de recurso, confirmado a existir sempre no servidor — usado enquanto
// o pacote dedicado de um plano ainda não tiver sido criado lá (ver
// resolveHostingPackageName).
const FALLBACK_PACKAGE = 'VisualDESIGN';

/**
 * Qual servidor de hospedagem recebe as contas NOVAS a partir de agora.
 * Só fica 'hestia' na instância do Contabo (variável definida só no
 * `.env.local` desse deploy) — o Hetzner nunca a recebe, por isso continua
 * 100% DirectAdmin sem qualquer mudança de comportamento.
 */
function resolveNewAccountProvider(): 'directadmin' | 'hestia' {
  return (process.env.DEFAULT_HOSTING_PROVIDER || '').trim().toLowerCase() === 'hestia'
    ? 'hestia'
    : 'directadmin';
}

let packageNameCache: { at: number; provider: string; names: Set<string> } | null = null;
const PACKAGE_NAME_CACHE_MS = 5 * 60 * 1000;

async function listRealPackageNames(provider: 'directadmin' | 'hestia'): Promise<Set<string>> {
  if (
    packageNameCache &&
    packageNameCache.provider === provider &&
    Date.now() - packageNameCache.at < PACKAGE_NAME_CACHE_MS
  ) {
    return packageNameCache.names;
  }
  try {
    const packages =
      provider === 'hestia' ? await listHestiaPackages() : await (await getAdminDirectAdminAPI()).listPackages();
    const names = new Set(packages.map((p) => String(p.packageName || '').trim()).filter(Boolean));
    packageNameCache = { at: Date.now(), provider, names };
    return names;
  } catch {
    // Falha a consultar o servidor: não presumir nada sobre o que existe lá —
    // devolve o que houver em cache (mesmo expirado) ou vazio, forçando o
    // fallback seguro em vez de arriscar um pacote inexistente.
    return packageNameCache?.provider === provider ? packageNameCache.names : new Set();
  }
}

/**
 * Cada plano do carrinho devia usar o seu próprio pacote DirectAdmin (limites
 * de espaço/banda/emails reais e diferentes por plano) — mas só se esse
 * pacote já existir de facto no servidor. Criar uma conta com um pacote que
 * não existe faz a criação falhar sempre (foi assim que ficou preso a um
 * pacote único antes). Enquanto o pacote dedicado não existir lá, cai no
 * pacote de recurso e avisa o admin, em vez de fingir que a diferenciação de
 * planos está a funcionar.
 */
async function resolveHostingPackageName(planId: string, provider: 'directadmin' | 'hestia'): Promise<string> {
  const desired = HOSTING_PLAN_PACKAGE_NAMES[planId];
  if (!desired) return FALLBACK_PACKAGE;
  const realNames = await listRealPackageNames(provider);
  if (realNames.has(desired)) return desired;
  await alertAdminOfTrackingFailure(
    'pacote de hospedagem em falta',
    `O plano "${planId}" devia usar o pacote "${desired}" no ${provider === 'hestia' ? 'HestiaCP' : 'DirectAdmin'}, mas esse pacote ainda não existe no servidor — a conta foi criada com "${FALLBACK_PACKAGE}" em vez disso, sem os limites do plano vendido. Cria o pacote "${desired}" para este plano ficar realmente diferenciado.`,
  );
  return FALLBACK_PACKAGE;
}

/**
 * Escolhe um username livre no espelho do painel (panel_users) — não no
 * DirectAdmin em si. O painel tem de conseguir registar a conta mesmo que o
 * servidor DA esteja indisponível ou tenha atingido o limite da licença, daí
 * verificar unicidade aqui e não via API DA (ver panel-server-provision.ts,
 * que faz a sincronização real de forma assíncrona e best-effort, com nova
 * tentativa automática mais tarde se falhar).
 */
async function pickAvailableMirrorUsername(base: string): Promise<string> {
  const sb = getDaSyncAdmin();
  const sanitized = sanitizeDaUsername(base);
  if (!sb) return sanitized;
  for (const candidate of [sanitized, `${sanitized}1`, `${sanitized}2`, `${sanitized}${Date.now().toString().slice(-4)}`]) {
    const { data } = await sb.from('panel_users').select('username').eq('username', candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${sanitized}${Date.now().toString().slice(-6)}`;
}

/** Mesma validação usada no checkout (#6) — reaproveitada pelo #32 (completar hospedagens pendentes). */
export const HOSTING_DOMAIN_REGEX = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/**
 * Cria a conta de hospedagem no painel (mirror + password) e dispara a
 * criação real no DirectAdmin em segundo plano, sem bloquear quem chamou.
 * Extraído do fluxo do checkout (item.type === 'hosting') para ser
 * reaproveitado também pelo #32 (completar hospedagens que ficaram
 * pendentes por não terem chegado com um domínio válido).
 */
export async function provisionHostingAccountOnPanel(params: {
  admin: SupabaseClient;
  userId: string;
  email: string;
  displayName: string;
  domainName: string;
  packageName: string;
  renewalId: string | null;
  sharedPassword?: string | null;
  /** Servidor de hospedagem que vai tratar esta conta. Omitir mantém o
   * comportamento actual (DirectAdmin). */
  provider?: 'directadmin' | 'hestia';
}): Promise<{ ok: boolean; daUsername: string; password: string; error?: string }> {
  const { admin, userId, email, displayName, domainName, packageName, renewalId } = params;
  try {
    const password = params.sharedPassword || generateProvisionerPassword();
    const daUsername = await pickAvailableMirrorUsername(domainName.split('.')[0] || email.split('@')[0]);

    const { saveProfileForAuthUser: savePassword } = await import('@/lib/profile-db');
    await savePassword(admin, userId, {
      email,
      da_password_encrypted: encryptDaSecret(password),
    });
    await upsertPanelAuthAccount(admin, {
      userId,
      email,
      role: 'client',
      name: displayName,
      serverLinked: false,
      daUsername: null,
      provider: params.provider,
    });
    await upsertMirrorUser({
      username: daUsername,
      email,
      first_name: displayName,
      acl: 'user',
      auth_user_id: userId,
      package_name: packageName,
      hosting_provider: params.provider,
    });
    await upsertMirrorSite({ domain: domainName, owner: daUsername, admin_email: email, package: packageName });

    const task = async () => {
      const result = await provisionPanelAccountToServer(daUsername);
      if (result.ok) {
        if (renewalId) {
          await admin.from('hosting_renewals').update({ status: 'active' }).eq('id', renewalId);
        }
      } else {
        // Fica 'pending' (já era) — não é 'active' enquanto o servidor não confirmar.
        console.error('[checkout-fulfillment] provisionamento de hospedagem falhou:', daUsername, result.error);
        await alertAdminOfTrackingFailure(
          'provisionamento de hospedagem',
          `${domainName} (${daUsername}): ${result.error || 'erro desconhecido'}`,
        );
      }
    };
    try {
      after(task);
    } catch {
      void task().catch((err) => console.error('[checkout-fulfillment] provisionamento de hospedagem:', err));
    }

    return { ok: true, daUsername, password };
  } catch (provisionError) {
    // Fica 'pending' (já era) — nada aqui chegou a tentar o servidor.
    const msg = provisionError instanceof Error ? provisionError.message : String(provisionError);
    console.error('[checkout-fulfillment] falha ao registar conta de hospedagem no painel:', msg);
    await alertAdminOfTrackingFailure('provisionamento de hospedagem', `${domainName}: ${msg}`);
    return { ok: false, daUsername: '', password: '', error: msg };
  }
}

function addYears(date: Date, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

/**
 * Contas de admin conhecidas (mesma lista usada em checkIsAdmin por todo o
 * código) — usada aqui para encontrar um destinatário real e válido em
 * auth.users, nunca a tabela profiles (ver nota abaixo).
 */
const KNOWN_ADMIN_EMAILS = [
  'admin@visualdesignmoz.com',
  'silva.chamo@gmail.com',
  'geral@visualdesignmoz.com',
  'suporte@visualdesignmoz.com',
];

/**
 * Regista uma notificação para um admin quando uma escrita de tracking de
 * renovação falha. Sem isto, uma falha aqui fica só num console.warn que
 * ninguém vê — foi assim que hosting_renewals ficou meses sem existir sem
 * ninguém notar. Nunca deve poder bloquear o checkout em si.
 *
 * Bug real encontrado (2026-08-08): isto nunca disparou nenhuma vez em
 * produção (tabela notifications sempre vazia) porque usava profiles.id como
 * user_id do destinatário — mas notifications.user_id tem FK para
 * auth.users(id), e profiles.id é uma chave própria da tabela, não o id do
 * utilizador (confirmado: para a conta admin@visualdesignmoz.com, profiles.id
 * não bate certo com auth.users.id; profiles.user_id sim). O insert falhava
 * sempre com violação de FK, engolida em silêncio pelo catch abaixo. Corrigido
 * lendo o id directamente de auth.users, nunca de profiles.
 */
export async function alertAdminOfTrackingFailure(context: string, message: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) return;
  try {
    const admin = createAdminClient(supabaseUrl, serviceKey);
    let adminUserId: string | null = null;
    for (let page = 1; page <= 20 && !adminUserId; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      const found = data.users.find((u) => u.email && KNOWN_ADMIN_EMAILS.includes(u.email.toLowerCase()));
      if (found) adminUserId = found.id;
      if (!data.users?.length || data.users.length < 1000) break;
    }
    if (!adminUserId) {
      console.error('[checkout-fulfillment] alertAdminOfTrackingFailure: nenhuma conta admin encontrada em auth.users');
      return;
    }
    const { error: insertError } = await admin.from('notifications').insert({
      user_id: adminUserId,
      title: 'Falha ao registar renovação',
      message: `[checkout-fulfillment] ${context}: ${message}`,
      type: 'error',
      category: 'system',
    });
    if (insertError) {
      console.error('[checkout-fulfillment] alertAdminOfTrackingFailure: falha ao inserir notificação:', insertError.message);
    }
  } catch (err) {
    // Um alerta falhado nunca deve impedir o checkout de terminar — mas fica
    // no log, para não repetir o mesmo silêncio total que escondeu este bug.
    console.error('[checkout-fulfillment] alertAdminOfTrackingFailure:', err);
  }
}

/**
 * Avisa o próprio cliente (não só o admin) quando o registo automático do
 * domínio que ele acabou de pagar falha a meio — sem isto o cliente via
 * "pagamento confirmado" e nada mais, sem saber que o domínio não chegou a
 * ficar registado no registador até um admin reparar na notificação interna.
 */
async function notifyClientOfDomainProvisionResult(
  admin: SupabaseClient,
  userId: string,
  domain: string,
  ok: boolean,
  detail: string,
) {
  try {
    await admin.from('notifications').insert({
      user_id: userId,
      title: ok ? 'Domínio registado' : 'Domínio: é preciso a nossa ajuda',
      message: ok
        ? `O domínio ${domain} ficou registado e configurado com sucesso.`
        : `Houve um problema a concluir o registo do domínio ${domain}. A nossa equipa já foi avisada e vai tratar disto — se preferir, contacte o suporte com este domínio.`,
      type: ok ? 'success' : 'error',
      category: 'system',
    });
  } catch {
    /* uma notificação falhada nunca deve impedir o checkout de terminar */
  }
}

/**
 * Promove guest -> client (metadata do Auth + profiles.role), sem tocar nos
 * produtos em si. Extraído do fim de `fulfillCheckout` para poder correr logo
 * na SUBMISSÃO da encomenda (antes de qualquer confirmação de pagamento) —
 * é o que deixa o cliente entrar já no painel real (`/cliente`) com a secção
 * do produto comprado visível mas desactivada, em vez de ser mandado para o
 * `/guest` genérico até um humano (M-Pesa/transferência) ou o webhook
 * (Stripe/saldo) confirmar. Nunca despromove uma conta já elevada
 * (admin/manager/reseller) — mesma regra de sempre.
 */
export async function promoteGuestToClient(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  if (!authUser?.user) return;
  const currentMetadata = authUser.user.user_metadata || {};
  const email = authUser.user.email;
  const displayName = currentMetadata.nome || currentMetadata.full_name || email?.split('@')[0];

  const existingProfile = await getProfileForAuthUser(admin, userId, email);

  // Só promove guest -> client. Nunca despromove uma conta já elevada (admin/manager/reseller)
  // que, por exemplo, esteja apenas a testar uma compra.
  const ELEVATED_ROLES = ['admin', 'manager', 'reseller'];
  const isElevated =
    ELEVATED_ROLES.includes(existingProfile?.role || '') || ELEVATED_ROLES.includes(currentMetadata.role);

  if (!isElevated) {
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { ...currentMetadata, role: 'client', nome: displayName },
    });
  }

  await saveProfileForAuthUser(admin, userId, {
    email,
    role: isElevated ? undefined : 'client',
    name: displayName,
  });
}

/**
 * Activa os produtos comprados (domínio/hospedagem/email) e promove a conta guest -> client.
 * Só deve ser chamada depois de o pagamento estar confirmado (webhook Stripe), nunca a partir
 * de um pedido directo do browser.
 */
export async function fulfillCheckout(
  supabase: SupabaseClient,
  userId: string,
  items: CatalogCartItem[],
  paymentMethod: string,
) {
  const today = new Date().toISOString().split('T')[0];
  const total = items.reduce((sum, item) => sum + (item.price || 0), 0);
  const created: string[] = [];

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const admin = serviceKey && supabaseUrl ? createAdminClient(supabaseUrl, serviceKey) : null;
  const { data: authUser } = admin ? await admin.auth.admin.getUserById(userId) : { data: null };
  const currentMetadata = authUser?.user?.user_metadata || {};
  const email = authUser?.user?.email;
  const displayName = currentMetadata.nome || currentMetadata.full_name || email?.split('@')[0];

  // Password partilhada entre o login do painel e a(s) conta(s) de
  // hospedagem criadas nesta compra — gerada uma única vez (se houver pelo
  // menos um item de hospedagem) e sincronizada no perfil auth mais abaixo,
  // para que o botão "Direct Admin" no painel entre por SSO assim que o
  // servidor confirmar a criação.
  let sharedHostingPassword: string | null = null;

  for (const item of items) {
    const years = item.period || 1;
    const expires = addYears(new Date(), years);
    // Hospedagem/email guardam period em MESES (ver CartDrawer.tsx — "Período: X
    // mês/meses"), nunca anos — usar addYears aqui já deu 1 ano de serviço de
    // graça a quem só pagou 1 mês. addMonths só se usa nestes dois tipos.
    const hostingExpires = addMonths(new Date(), item.period || 1);

    if (item.type === 'domain' && item.authCode) {
      // Transferência de outro registador — nunca assumir posse já: o
      // domínio só passa a 'active' quando o registador antigo aprovar a
      // sério (ver /api/domain-transfer/status, que consulta a Dynadot e
      // actualiza isto). Sem isto, "Meus Domínios" mostraria como nosso um
      // domínio que ainda pode ser rejeitado do outro lado.
      const domainName = item.name.toLowerCase().trim();
      const { error } = await supabase.from('domain_renewals').upsert(
        {
          user_id: userId,
          domain_name: domainName,
          registration_date: today,
          expiration_date: expires,
          renewal_price: item.price,
          currency: 'MZN',
          status: 'transferring',
          registrar: 'VisualDesign',
          notes: `Transferência pedida (${paymentMethod})`,
        },
        { onConflict: 'user_id,domain_name', ignoreDuplicates: false },
      );
      if (error) {
        console.warn('[checkout-fulfillment] domain_renewals (transferência):', error.message);
        await alertAdminOfTrackingFailure('domain_renewals (transferência)', error.message);
      }
      created.push(`transferência:${domainName}`);

      if (admin) {
        const { submitDomainTransfer } = await import('@/lib/domain-transfer-provision');
        const task = async () => {
          const result = await submitDomainTransfer(admin, userId, domainName, item.authCode!, years);
          if (!result.ok) {
            console.error('[checkout-fulfillment] falha ao submeter transferência:', domainName, result.error);
            await alertAdminOfTrackingFailure('transferência de domínio', `${domainName}: ${result.error}`);
            await notifyClientOfDomainProvisionResult(admin, userId, domainName, false, result.error);
          } else {
            await admin.from('notifications').insert({
              user_id: userId,
              title: 'Transferência de domínio pedida',
              message: `O pedido de transferência de ${domainName} foi enviado ao registador. Isto pode demorar alguns dias — vai receber um aviso quando ficar concluído.`,
              type: 'success',
              category: 'system',
            });
          }
        };
        try {
          after(task);
        } catch {
          void task().catch((err) => console.error('[checkout-fulfillment] transferência de domínio:', err));
        }
      }
      continue;
    }

    if (item.type === 'domain') {
      const domainName = item.name.toLowerCase().trim();
      // .app/.dev não registam pela API da Dynadot — entram como `pending` e
      // a equipa regista à mão. Todos os outros seguem o fluxo automático e
      // só passam a `active` quando o registo confirma (ver mais abaixo).
      const manualRegistration = requiresManualRegistration(domainName);
      const initialStatus = manualRegistration ? 'pending' : 'active';
      const initialNotes = manualRegistration
        ? `Compra carrinho (${paymentMethod}) — extensão de registo manual (.app/.dev): registar na Dynadot e concluir com "Mover domínio" + "Reprovisionar".`
        : `Compra carrinho (${paymentMethod})`;
      const { error } = await supabase.from('domain_renewals').upsert(
        {
          user_id: userId,
          domain_name: domainName,
          registration_date: today,
          expiration_date: expires,
          renewal_price: item.price,
          currency: 'MZN',
          status: initialStatus,
          registrar: 'VisualDesign',
          notes: initialNotes,
        },
        { onConflict: 'user_id,domain_name', ignoreDuplicates: false },
      );
      if (error) {
        const { error: insErr } = await supabase.from('domain_renewals').insert({
          user_id: userId,
          domain_name: domainName,
          registration_date: today,
          expiration_date: expires,
          renewal_price: item.price,
          currency: 'MZN',
          status: initialStatus,
          registrar: 'VisualDesign',
          notes: initialNotes,
        });
        if (insErr) {
          console.warn('[checkout-fulfillment] domain_renewals:', insErr.message);
          await alertAdminOfTrackingFailure('domain_renewals', insErr.message);
        }
      }
      created.push(`domínio:${domainName}`);

      // .app/.dev: não tentar registar pela API (falha sempre) — avisar a
      // equipa para tratar à mão e o cliente para saber que está em curso.
      if (manualRegistration) {
        if (admin) {
          await alertAdminOfTrackingFailure(
            'registo manual de domínio',
            `${domainName} (${paymentMethod}): a extensão não regista pela API da Dynadot. Registar à mão em dynadot.com (mesma conta), depois no painel abrir Domínios → "Mover domínio para outra conta" (${domainName} + email do cliente) e no domínio → "Reprovisionar".`,
          );
          try {
            await admin.from('notifications').insert({
              user_id: userId,
              title: 'Domínio recebido — a processar',
              message: `Recebemos o pedido do domínio ${domainName}. Esta extensão é activada manualmente pela nossa equipa (normalmente até 1 dia útil). Avisamos assim que estiver pronto.`,
              type: 'info',
              category: 'system',
            });
          } catch {
            /* nunca falhar o checkout por causa de uma notificação */
          }
        }
        continue;
      }

      // Se o cliente já tinha um plano de email comprado à espera de
      // domínio, este domínio novo fica automaticamente ligado a ele — a
      // opção "comprar domínio connosco" no aviso do painel passa por aqui.
      // Não ter plano pendente é o caso normal (resultado ok:false), não um erro.
      if (admin && email) {
        const { attachDomainToEmailPlan } = await import('@/lib/email-plan-provision');
        await attachDomainToEmailPlan(admin, userId, domainName, email, displayName).catch(() => {});
      }

      // Regista o domínio a sério no registador, cria a zona na Cloudflare,
      // aponta os nameservers para lá, aplica o DNS de e-mail e cria o
      // remetente geral@dominio no Brevo — tudo em segundo plano (envolve
      // chamadas a 3 serviços externos, não deve atrasar a resposta do
      // checkout). Best-effort: se falhar a meio (ex. saldo do registador
      // insuficiente), o domínio já ficou registado no painel (passo acima)
      // para um admin tratar manualmente; o aviso vai para as notificações.
      if (admin) {
        const { data: profileForDomain } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        const task = async () => {
          const result = await autoProvisionPurchasedDomain({
            domain: domainName,
            years,
            profile: profileForDomain,
            userEmail: email || '',
            displayName,
          });
          if (!result.ok) {
            const failed = result.steps.filter((s) => !s.ok).map((s) => `${s.step}: ${s.error}`).join(' | ');
            console.error('[checkout-fulfillment] auto-provisionamento de domínio incompleto:', domainName, failed);
            await alertAdminOfTrackingFailure('auto-provisionamento de domínio', `${domainName}: ${failed}`);
            const registoStep = result.steps.find((s) => s.step === 'registo');
            // Se o REGISTO em si falhou, o domínio não é nosso — não pode
            // ficar como 'active' (era este o bug do menocrazy.app: aparecia
            // ao cliente como registado quando a Dynadot o tinha recusado).
            // Volta a 'pending' até um admin tratar.
            if (registoStep && !registoStep.ok) {
              await supabase
                .from('domain_renewals')
                .update({
                  status: 'pending',
                  dns_status: 'pending',
                  notes: `Registo não concluído — a aguardar intervenção da equipa: ${failed}`,
                })
                .eq('user_id', userId)
                .eq('domain_name', domainName);
            }
            // #9: a zona Cloudflare e os nameservers também impedem o domínio de
            // resolver para algo — sem isto o cliente via "Domínio registado" e
            // achava que estava tudo bem, sem saber que o site ainda não aponta
            // para lado nenhum. `dns_status` marca isto para o painel poder
            // mostrar "a aguardar configuração de DNS".
            const zonaStep = result.steps.find((s) => s.step === 'zona-cloudflare');
            const nsStep = result.steps.find((s) => s.step === 'nameservers');
            const dnsBlocked = (zonaStep && !zonaStep.ok) || (nsStep && !nsStep.ok);
            if (dnsBlocked && !(registoStep && !registoStep.ok)) {
              await supabase
                .from('domain_renewals')
                .update({ dns_status: 'pending', notes: `DNS por configurar: ${failed}` })
                .eq('user_id', userId)
                .eq('domain_name', domainName);
            }
            if ((registoStep && !registoStep.ok) || dnsBlocked) {
              await notifyClientOfDomainProvisionResult(admin, userId, domainName, false, failed);
            }
          } else {
            await supabase
              .from('domain_renewals')
              .update({ dns_status: 'ok' })
              .eq('user_id', userId)
              .eq('domain_name', domainName);
            await notifyClientOfDomainProvisionResult(admin, userId, domainName, true, '');
          }
        };
        try {
          after(task);
        } catch {
          void task().catch((err) => console.error('[checkout-fulfillment] auto-provisionamento de domínio:', err));
        }
      }
    }

    if (item.type === 'hosting') {
      // #6: o domínio de destino nunca vem de `name` (nome comercial do
      // plano, ex. "Alojamento Web Básico") — isso fazia a criação da conta
      // no DirectAdmin falhar sempre e a hospedagem ficar presa em
      // "a provisionar". Vem de `hostingDomain`, pedido no checkout.
      const rawHostingDomain = (item.hostingDomain || '').toLowerCase().trim();
      const hostingDomainValid = HOSTING_DOMAIN_REGEX.test(rawHostingDomain);
      if (!hostingDomainValid) {
        // Sem domínio válido não há nada para provisionar a sério — regista o
        // pedido para o admin tratar manualmente em vez de criar uma conta
        // com um "domínio" inválido (o que falhava sempre no DirectAdmin).
        await alertAdminOfTrackingFailure(
          'hospedagem sem domínio válido',
          `Compra de hospedagem (${item.name}, ${paymentMethod}) chegou sem um domínio de destino válido — utilizador ${userId}. Não foi provisionada automaticamente; precisa de ser associada a um domínio manualmente.`,
        );
      }
      const domainName = hostingDomainValid ? rawHostingDomain : '';
      const hostingProvider = resolveNewAccountProvider();
      const packageName = await resolveHostingPackageName(item.id, hostingProvider);
      // Só há algo para provisionar no servidor se houver admin client e email —
      // sem isso o bloco abaixo nem tenta, por isso o estado fica 'active' de
      // imediato (nada realmente pendente). Quando há tentativa real, o
      // estado começa em 'pending' ("A provisionar" no painel do cliente) e
      // só passa a 'active' quando o servidor confirmar (ver task() abaixo)
      // — nunca antes disso. Usa 'pending' (não um valor novo) porque é o
      // único estado "ainda não activo" já aceite pelo CHECK constraint de
      // hosting_renewals.status.
      const willProvision = Boolean(admin && email);
      const { data: renewalRow, error: insErr } = await supabase
        .from('hosting_renewals')
        .insert({
          user_id: userId,
          domain_name: domainName,
          package_name: packageName,
          start_date: today,
          expiration_date: hostingExpires,
          renewal_price: item.price,
          currency: 'MZN',
          status: willProvision ? 'pending' : 'active',
          server: hostingProvider === 'hestia' ? 'Hestia' : 'DirectAdmin',
          notes: `Compra carrinho (${paymentMethod})`,
        })
        .select('id')
        .single();
      if (insErr) {
        console.warn('[checkout-fulfillment] hosting_renewals:', insErr.message);
        await alertAdminOfTrackingFailure('hosting_renewals', insErr.message);
      }
      created.push(`hospedagem:${domainName}`);
      const renewalId = renewalRow?.id ?? null;

      // Regista a conta no painel (espelho Supabase) já, automaticamente —
      // o cliente é levado para o painel dele logo a seguir ao pagamento, com
      // a hospedagem lá mesmo antes de o servidor confirmar (estado
      // "A provisionar"). A criação real no DirectAdmin corre em segundo
      // plano (after()), sem bloquear o checkout — mas o resultado é sempre
      // usado para actualizar o estado real e, se falhar, avisar o admin.
      // Nova tentativa automática mais tarde continua a acontecer via
      // provisionPendingPanelAccounts (sync periódico). #6: sem um domínio
      // válido não há nada de real para provisionar — fica 'pending' à
      // espera de um admin associar o domínio certo, em vez de criar uma
      // conta com um domínio inventado (ex.: "<username>.com").
      if (admin && email && hostingDomainValid) {
        if (!sharedHostingPassword) sharedHostingPassword = generateProvisionerPassword();
        await provisionHostingAccountOnPanel({
          admin,
          userId,
          email,
          displayName,
          domainName,
          packageName,
          renewalId,
          sharedPassword: sharedHostingPassword,
          provider: hostingProvider,
        });
      }
    }

    if (item.type === 'email') {
      // O plano de email não vem com domínio — o cliente escolhe (ou compra
      // um connosco) depois, já no painel dele (ver EMAIL_PLAN_PACKAGE_NAME
      // em user-products.ts e /api/client/attach-email-domain). domain_name
      // fica vazio até isso acontecer.
      const { error: insErr } = await supabase.from('hosting_renewals').insert({
        user_id: userId,
        domain_name: '',
        package_name: 'Email Básico',
        start_date: today,
        expiration_date: hostingExpires,
        renewal_price: item.price,
        currency: 'MZN',
        status: 'active',
        server: 'Mail',
        notes: `Plano de e-mail (${paymentMethod}) — aguarda domínio`,
      });
      if (insErr) {
        console.warn('[checkout-fulfillment] email plano:', insErr.message);
        await alertAdminOfTrackingFailure('hosting_renewals (email)', insErr.message);
      }
      created.push('email:plano-basico');
    }
  }

  await supabase.from('pagamentos').insert({
    user_id: userId,
    domain: items.map((i) => i.name).join(', '),
    valor: total,
    vencimento: today,
    metodo: paymentMethod,
    pago_em: new Date().toISOString(),
    status: 'paid',
  });

  // #5: a password de login (Supabase Auth) do cliente nunca é tocada por
  // promoteGuestToClient — era sobrescrita pela password gerada para a conta
  // de hospedagem, o que trancava o cliente fora da própria conta depois de
  // comprar. O botão "Direct Admin" não depende delas serem iguais: usa um
  // one-time login-url por username (ver /api/client-directadmin-access), e
  // a criação real da conta no servidor lê a password de
  // profiles.da_password_encrypted (gravada acima, sharedHostingPassword),
  // não a de login. Normalmente já é chamada de novo aqui (idempotente — ver
  // §submissão da encomenda), mas mantém-se também aqui para o caso de
  // `fulfillCheckout` ser invocada por um caminho que nunca passou por lá
  // (ex.: script de correcção manual/admin).
  if (admin) await promoteGuestToClient(admin, userId);

  return { created, total };
}
