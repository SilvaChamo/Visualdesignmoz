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
import { gravarPacote, listPackages as listHestiaPackages } from '@/lib/hestia-adapter';
import { HOSTING_PLAN_PRESETS } from '@/lib/reseller-package-form';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { autoProvisionPurchasedDomain } from '@/lib/domain-purchase-provision';
import { requiresManualRegistration } from '@/lib/domain-registration-support';
import { after } from 'next/server';
import { getProfileForAuthUser, saveProfileForAuthUser } from '@/lib/profile-db';
import { buyerRoleForPackage, isProfissionalHostingPlan } from '@/lib/user-roles';
import { emailPlanProductName, getEmailPlan } from '@/lib/email-plans';
import { PACOTES_HOSPEDAGEM, pacoteNoServidor } from '@/lib/pacotes-compra';
import { PANEL_SLUG } from '@/lib/panel-tenant';

// Pacote dedicado por plano: ver PACOTES_HOSPEDAGEM em pacotes-compra.ts (a mesma tabela do painel de quem espera confirmação).
const HOSTING_PLAN_PACKAGE_NAMES = PACOTES_HOSPEDAGEM;

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

/** Cria no servidor o pacote de um plano de hospedagem, com os limites do plano (HOSTING_PLAN_PRESETS). Devolve false se o servidor recusar. */
async function criarPacoteDoPlano(planId: string, nome: string): Promise<boolean> {
  const limites = HOSTING_PLAN_PRESETS.find((p) => p.id === planId)?.form.limits;
  if (!limites) return false;
  const valor = (k: keyof typeof limites) => (limites[k].unlimited ? 'unlimited' : limites[k].value);
  const feito = await gravarPacote(
    nome,
    { DISK_QUOTA: valor('quota'), BANDWIDTH: valor('bandwidth'), WEB_DOMAINS: valor('vdomains'), MAIL_ACCOUNTS: valor('nemails'), DATABASES: valor('mysql') },
    false,
  );
  if (!feito.ok) {
    console.error('[checkout-fulfillment] não foi possível criar o pacote do plano:', nome, feito.error);
    return false;
  }
  packageNameCache = null;
  return true;
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
  const desired = HOSTING_PLAN_PACKAGE_NAMES[planId] || FALLBACK_PACKAGE;
  let { nome, recurso } = pacoteNoServidor(desired, await listRealPackageNames(provider));
  if (recurso && provider === 'hestia' && HOSTING_PLAN_PACKAGE_NAMES[planId]) {
    // o pacote do plano ainda não existe: cria-se com os limites do plano (Admin › Pacotes pode depois ajustá-los)
    const criado = await criarPacoteDoPlano(planId, desired);
    if (criado) ({ nome, recurso } = { nome: desired, recurso: false });
  }
  if (recurso) {
    await alertAdminOfTrackingFailure(
      'pacote de hospedagem em falta',
      `O plano "${planId}" devia usar o pacote "${desired}" no ${provider === 'hestia' ? 'HestiaCP' : 'DirectAdmin'}, mas esse pacote não existe no servidor — a conta foi criada com "${nome}" em vez disso, sem os limites do plano vendido. Cria o pacote "${desired}" para este plano ficar realmente diferenciado.`,
    );
  }
  return nome;
}

/**
 * Escolhe um username livre no espelho do painel (panel_users) — não no
 * DirectAdmin em si. O painel tem de conseguir registar a conta mesmo que o
 * servidor DA esteja indisponível ou tenha atingido o limite da licença, daí
 * verificar unicidade aqui e não via API DA (ver panel-server-provision.ts,
 * que faz a sincronização real de forma assíncrona e best-effort, com nova
 * tentativa automática mais tarde se falhar).
 */
async function pickAvailableMirrorUsername(base: string, repetida: { userId: string; domain: string } | null): Promise<string> {
  const sb = getDaSyncAdmin();
  const sanitized = sanitizeDaUsername(base);
  if (!sb) return sanitized;
  // «Confirmar» repetido depois de uma falha: a conta que a primeira tentativa já registou para este domínio reaproveita-se
  // (outra conta nova duplicava a hospedagem).
  if (repetida) {
    const { data: site } = await sb.from('panel_sites').select('owner').eq('domain', repetida.domain).maybeSingle();
    if (site?.owner) {
      const { data: dono } = await sb.from('panel_users').select('auth_user_id').eq('username', site.owner).maybeSingle();
      if (dono?.auth_user_id === repetida.userId) return String(site.owner);
    }
  }
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
  /** Plano comprado (`hosting-basico`, `hosting-pro`, …) — decide o painel Cliente/Profissional. Sem ele, decide o
   * pacote (packageName). */
  planId?: string;
  /** Servidor de hospedagem que vai tratar esta conta. Omitir mantém o
   * comportamento actual (DirectAdmin). */
  provider?: 'directadmin' | 'hestia';
  /** Nome de utilizador escolhido no checkout para esta conta de hospedagem (se estiver ocupado, escolhe-se um parecido). */
  username?: string;
  /** Espera (até ~45 s) pelo resultado no servidor em vez de o deixar em segundo plano — usado pelo «Confirmar» da equipa,
   *  para dizer logo se a conta foi criada ou porque não foi. */
  esperar?: boolean;
  /** O «Confirmar» já correu antes para este item: reaproveita a conta que ficou registada no painel. */
  repetida?: boolean;
}): Promise<{ ok: boolean; daUsername: string; password: string; error?: string; servidor?: { ok: boolean; error?: string; pendente?: boolean; aviso?: string } }> {
  const { admin, userId, email, displayName, domainName, packageName, renewalId } = params;
  try {
    const password = params.sharedPassword || generateProvisionerPassword();
    const daUsername = await pickAvailableMirrorUsername(params.username || domainName.split('.')[0] || email.split('@')[0], params.repetida ? { userId, domain: domainName } : null);

    // Painel pelo plano (ver promoteBuyerAfterPurchase): Pro/Business/Enterprise
    // → 'profissional'; Básico → 'client'. Contas da equipa
    // (admin/manager/reseller) ficam como estão.
    const existingProfile = await getProfileForAuthUser(admin, userId, email);
    // Quem já tem uma conta no servidor e compra outra hospedagem recebe uma conta NOVA (o seu domínio, o seu nome de
    // utilizador), sem mexer na conta que já tinha: o perfil, a ligação ao servidor e a palavra-passe da principal ficam como estão.
    // «Já tem conta no servidor» vê-se pelo perfil e também pela ligação do login (um administrador, por exemplo, está ligado à conta
    // principal sem ter `da_username`): nesse caso esta compra cria uma conta NOVA, em vez de se dar por feita a que já existia.
    const { data: ligacao } = await admin
      .from('panel_auth_accounts')
      .select('server_linked')
      .eq('user_id', userId)
      .eq('panel_slug', PANEL_SLUG.toLowerCase())
      .maybeSingle();
    const adicional = Boolean(String(existingProfile?.da_username || '').trim()) || ligacao?.server_linked === true;
    if (!adicional) {
      const { saveProfileForAuthUser: savePassword } = await import('@/lib/profile-db');
      await savePassword(admin, userId, {
        email,
        da_password_encrypted: encryptDaSecret(password),
      });
    }
    const STAFF_ROLES = ['admin', 'manager', 'reseller'];
    const resolvedRole = STAFF_ROLES.includes(existingProfile?.role || '')
      ? (existingProfile!.role as 'admin' | 'manager' | 'reseller')
      : ((await promoteBuyerAfterPurchase(admin, userId, [
          { type: 'hosting', id: params.planId, packageName },
        ])) ?? 'client');
    if (!adicional) {
      await upsertPanelAuthAccount(admin, {
        userId,
        email,
        role: resolvedRole,
        name: displayName,
        serverLinked: false,
        daUsername: null,
        provider: params.provider,
      });
    }
    const contaPainel = await upsertMirrorUser({
      username: daUsername,
      email,
      first_name: displayName,
      acl: 'user',
      auth_user_id: userId,
      package_name: packageName,
      hosting_provider: params.provider,
    });
    if (!contaPainel.ok) throw new Error(`Não foi possível registar a conta no painel: ${contaPainel.error || 'erro desconhecido'}`);
    const sitePainel = await upsertMirrorSite({ domain: domainName, owner: daUsername, admin_email: email, package: packageName });
    if (!sitePainel.ok) throw new Error(`Não foi possível associar o domínio à conta no painel: ${sitePainel.error || 'erro desconhecido'}`);
    // a conta nova nasce sem a palavra-passe no registo (o upsert acima não a grava): vai logo a seguir, só para as contas adicionais
    if (adicional) await admin.from('panel_users').update({ da_password_encrypted: encryptDaSecret(password) }).eq('username', daUsername);

    const task = async (): Promise<{ ok: boolean; error?: string; aviso?: string }> => {
      const result = await provisionPanelAccountToServer(daUsername, { adicional });
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
      if (result.ok && result.aviso) {
        await alertAdminOfTrackingFailure('hospedagem criada com aviso', `${domainName} (${daUsername}): ${result.aviso}`);
      }
      return { ok: result.ok, error: result.error, aviso: result.aviso };
    };
    if (params.esperar) {
      const limite = new Promise<{ ok: boolean; error?: string; pendente?: boolean; aviso?: string }>((resolve) =>
        setTimeout(() => resolve({ ok: true, pendente: true }), 45_000),
      );
      const servidor = await Promise.race([task().catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e) })), limite]);
      return { ok: true, daUsername, password, servidor };
    }
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
      // Título tem de reflectir o que falhou de facto — este alerta é
      // reutilizado tanto para falhas em renovações como em compras novas
      // (e noutros contextos), e "Falha ao registar renovação" era enganoso
      // sempre que `context` não era mesmo uma renovação.
      title: `Falha: ${context}`,
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
 * Painel de quem compra a si próprio, decidido pelo plano (pedido do Silva,
 * 12/10/2026 — substitui a regra de 8 out "com site = Profissional", que punha
 * todo o plano Básico no painel Profissional):
 * - alojamento Pro, Business ou Enterprise → 'profissional';
 * - alojamento Básico, planos de email e domínios → 'client'.
 * Um 'client' que compre um plano Pro+ passa a 'profissional'. Nunca mexe em
 * admin/manager/reseller, nem desce um 'profissional' a 'client' (quem já tem
 * um plano Pro e compra um email continua Profissional). Corre já na
 * submissão do pedido (para entrar logo no painel certo enquanto aguarda a
 * confirmação do pagamento) e outra vez no fulfillment. Devolve o papel
 * gravado (null para contas da equipa).
 */
export async function promoteBuyerAfterPurchase(
  admin: SupabaseClient,
  userId: string,
  items: { type: string; id?: string; packageName?: string }[],
): Promise<'profissional' | 'client' | null> {
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  if (!authUser?.user) return null;
  const currentMetadata = authUser.user.user_metadata || {};
  const email = authUser.user.email;
  const displayName = currentMetadata.nome || currentMetadata.full_name || email?.split('@')[0];

  const existingProfile = await getProfileForAuthUser(admin, userId, email);
  const roles = [existingProfile?.role, currentMetadata.role].map((r) => String(r || ''));

  const STAFF_ROLES = ['admin', 'manager', 'reseller'];
  let nextRole: 'profissional' | 'client' | null = null;
  if (!roles.some((r) => STAFF_ROLES.includes(r))) {
    const planoPro = items.some(
      (i) =>
        i.type === 'hosting' &&
        (isProfissionalHostingPlan(i.id) || (!i.id && buyerRoleForPackage(i.packageName) === 'profissional')),
    );
    nextRole = planoPro || existingProfile?.role === 'profissional' ? 'profissional' : 'client';
  }

  if (nextRole) {
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { ...currentMetadata, role: nextRole, nome: displayName },
    });
  }

  await saveProfileForAuthUser(admin, userId, {
    email,
    role: nextRole ?? undefined,
    name: displayName,
  });
  return nextRole;
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
  /** Todos os itens do pedido, quando só alguns são activados agora (a equipa confirma item a item): a conta «só domínio»
   *  decide-se olhando para o pedido inteiro, não só para o item que se confirma. */
  itensDoPedido?: CatalogCartItem[],
  /** `chave`: identifica este item do pedido (`<pedido>:<posição>`); repetir o «Confirmar» depois de uma falha não duplica o registo da hospedagem. */
  opcoes: { esperarServidor?: boolean; chave?: string } = {},
) {
  const avisos: string[] = [];
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
            `${domainName} (${paymentMethod}): a extensão .app/.dev não regista pela API da Dynadot. 1) Registar à mão em dynadot.com (mesma conta). 2) No painel: Domínios → "Mover domínio para outra conta" (${domainName} + email do cliente). 3) Abrir o domínio → "Reprocessar DNS" (a partir daí é automático — zona Cloudflare, nameservers e DNS de email).`,
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
            // A Brevo pode demorar até 48h a confirmar a propagação do DNS
            // (ver triggerBrevoDomainVerification) — as poucas tentativas
            // rápidas feitas aqui quase nunca chegam a tempo. `brevo_verified`
            // fica `false` nesse caso (o normal, não um erro) e o cron
            // brevo-retry vai voltar a tentar sozinho até confirmar.
            await supabase
              .from('domain_renewals')
              .update({ dns_status: 'ok', brevo_verified: Boolean(result.emailDns?.verified) })
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
      const notas = `Compra carrinho (${paymentMethod})${opcoes.chave ? ` [item:${opcoes.chave}]` : ''}`;
      let renewalRow: { id: string; status?: string } | null = null;
      let reutilizada = false;
      if (opcoes.chave) {
        const { data: existente } = await supabase
          .from('hosting_renewals')
          .select('id, status')
          .eq('user_id', userId)
          .eq('notes', notas)
          .maybeSingle();
        renewalRow = existente;
        reutilizada = Boolean(existente);
      }
      if (!renewalRow) {
        const { data: inserida, error: insErr } = await supabase
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
            notes: notas,
          })
          .select('id, status')
          .single();
        if (insErr) {
          console.warn('[checkout-fulfillment] hosting_renewals:', insErr.message);
          await alertAdminOfTrackingFailure('hosting_renewals', insErr.message);
        }
        renewalRow = inserida;
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
      if (admin && email && hostingDomainValid && renewalRow?.status !== 'active') {
        if (!sharedHostingPassword) sharedHostingPassword = generateProvisionerPassword();
        const feita = await provisionHostingAccountOnPanel({
          admin,
          userId,
          email,
          displayName,
          domainName,
          packageName,
          renewalId,
          sharedPassword: sharedHostingPassword,
          provider: hostingProvider,
          planId: item.id,
          username: item.contaUtilizador,
          esperar: opcoes.esperarServidor,
          repetida: reutilizada,
        });
        if (!feita.ok) avisos.push(`${domainName}: não foi possível registar a conta (${feita.error || 'erro desconhecido'}).`);
        else if (feita.servidor?.pendente) avisos.push(`${domainName}: a conta ainda está a ser criada no servidor; confirme daqui a pouco na lista de utilizadores.`);
        else if (feita.servidor?.ok && feita.servidor.aviso) avisos.push(`${domainName}: ${feita.servidor.aviso}`);
        else if (feita.servidor && !feita.servidor.ok) avisos.push(`${domainName}: a conta não foi criada no servidor (${feita.servidor.error || 'erro desconhecido'}).`);
      } else if (item.type === 'hosting') {
        avisos.push(`${domainName || item.name}: sem um domínio válido não se cria a conta no servidor; defina o domínio da hospedagem.`);
      }
    }

    if (item.type === 'email') {
      // O plano de email não vem com domínio — o cliente escolhe (ou compra
      // um connosco) depois, já no painel dele (/api/client/attach-email-domain,
      // que cria então a conta no servidor com o pacote do plano — ver
      // email-plans.ts). domain_name fica vazio até isso acontecer.
      const emailPlan = getEmailPlan(item.id);
      const { error: insErr } = await supabase.from('hosting_renewals').insert({
        user_id: userId,
        domain_name: '',
        package_name: emailPlan ? emailPlanProductName(emailPlan) : item.name,
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
      created.push(`email:${item.id}`);
      // O plano de e-mail compra-se já com o domínio (Silva, 17/10/2026: "ou compra ou traz um"), escolhido no passo
      // /checkout/dominio: a conta no servidor é criada logo com ele. Se o domínio vem na mesma compra e o item dele
      // já passou, o plano já ficou ligado (ver acima) e isto não faz nada; se vem depois, liga-se aqui primeiro.
      const emailDomain = (item.hostingDomain || '').toLowerCase().trim();
      if (!insErr && admin && email && HOSTING_DOMAIN_REGEX.test(emailDomain)) {
        const { attachDomainToEmailPlan } = await import('@/lib/email-plan-provision');
        const ligado = await attachDomainToEmailPlan(admin, userId, emailDomain, email, displayName).catch(
          (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }),
        );
        // as falhas no servidor já avisam a equipa lá dentro ("A nossa equipa foi avisada"); as outras avisam aqui
        if (!ligado.ok && !/nenhum plano de email à espera|equipa foi avisada/i.test(ligado.error))
          await alertAdminOfTrackingFailure('plano de email', `${emailDomain} (${item.name}): ${ligado.error}`);
      }
    }
  }

  // Só domínio(s) na compra, sem alojamento nem e-mail: o cliente entra no painel com um painel só do domínio (pacote
  // VD-Dominio — ver domain-only-provision.ts). Com alojamento ou e-mail na mesma compra, a conta é a desse plano.
  const soDominios = items
    .filter((i) => i.type === 'domain')
    .map((i) => i.name.toLowerCase().trim())
    .filter((d) => HOSTING_DOMAIN_REGEX.test(d));
  const pedidoInteiro = itensDoPedido && itensDoPedido.length ? itensDoPedido : items;
  if (admin && email && soDominios.length && !pedidoInteiro.some((i) => i.type === 'hosting' || i.type === 'email')) {
    const { provisionDomainOnlyAccount } = await import('@/lib/domain-only-provision');
    const conta = await provisionDomainOnlyAccount(admin, userId, soDominios, email, displayName).catch(
      (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }),
    );
    if (!conta.ok) await alertAdminOfTrackingFailure('conta só de domínio', `${soDominios.join(', ')}: ${conta.error}`);
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
  // promoteBuyerAfterPurchase — era sobrescrita pela password gerada para a
  // conta de hospedagem, o que trancava o cliente fora da própria conta
  // depois de comprar. O botão "Direct Admin" não depende delas serem
  // iguais: usa um one-time login-url por username (ver
  // /api/client-directadmin-access), e a criação real da conta no servidor
  // lê a password de profiles.da_password_encrypted (gravada acima,
  // sharedHostingPassword), não a de login. Normalmente já é chamada de novo
  // aqui (idempotente — ver §submissão da encomenda), mas mantém-se também
  // aqui para o caso de `fulfillCheckout` ser invocada por um caminho que
  // nunca passou por lá (ex.: script de correcção manual/admin).
  if (admin) await promoteBuyerAfterPurchase(admin, userId, items);

  return { created, total, avisos };
}
