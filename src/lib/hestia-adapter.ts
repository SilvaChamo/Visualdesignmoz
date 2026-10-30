/**
 * Operações de ciclo de vida de conta no HestiaCP — equivalente ao subconjunto
 * de `directadmin-adapter.ts` realmente usado pelo checkout e pela gestão de
 * clientes (ver plano: criar/suspender/reactivar/apagar/mudar password).
 */

import { hestiaCall, hestiaCallJson } from '@/lib/hestia-client';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { getPhpMyAdminUrl } from '@/lib/server-config';
import { juntarCamposPacote } from '@/lib/pacote-hestia';
import { alojamentoVercel } from '@/lib/hospedagem-dns';
import { procurarPacote } from '@/lib/pacotes-compra';

function isAlreadyExistsError(error?: string): boolean {
  return (error || '').toLowerCase().includes('exists');
}

/**
 * Emite/instala o certificado Let's Encrypt de um site Hestia e recarrega o
 * nginx logo a seguir. O `v-add-letsencrypt-domain` nem sempre deixa o nginx
 * a servir já o certificado novo; sem este reload o site fica com o
 * certificado errado até ao próximo restart. O reload é best-effort — não
 * faz falhar a emissão se não passar.
 */
export async function issueLetsEncrypt(
  username: string,
  domain: string,
  /** apontadores a incluir no certificado; omitido = o que o Hestia fizer por defeito */
  aliases?: string[],
): Promise<{ ok: boolean; error?: string; output?: string; skipped?: boolean }> {
  // Silva, 26/10/2026: um site que está na Vercel (pelos nameservers ou pelo registo do domínio) tem o certificado da Vercel; o domínio nem
  // aponta para este servidor e o Let's Encrypt não conseguiria validar. Não se pede aqui. (O certificado do e-mail, mail.<domínio>, é outro caso.)
  if ((await alojamentoVercel(domain).catch(() => null)) === true) {
    return { ok: true, skipped: true, output: `O site de ${domain} está na Vercel (pelo DNS): o certificado é da Vercel, por isso não se pede aqui.` };
  }
  const result = await hestiaCall(
    'v-add-letsencrypt-domain',
    [username, domain, ...(aliases?.length ? [aliases.join(',')] : [])],
    { timeoutMs: 120_000, sshTimeoutMs: 120_000, sshFallbackOnTransportError: false },
  );
  return finishLetsEncrypt(result);
}

/** O pedido de certificado ao criar uma conta ou um site, por trás e sem esperar: nunca para um site da Vercel (ver issueLetsEncrypt) */
function pedirLetsEncryptPorTras(username: string, domain: string): void {
  void (async () => {
    if ((await alojamentoVercel(domain).catch(() => null)) === true) return;
    await hestiaCall('v-add-letsencrypt-domain', [username, domain]).catch(() => {});
  })();
}

/** Nenhuma conta se cria sem e-mail (Silva, 17/10/2026): é o e-mail que dá à conta o login do site e do painel. A
 *  conta mltmark, importada sem ele, ficou sem forma de entrar. */
export const SEM_EMAIL = 'Não se cria uma conta sem e-mail: escreva o e-mail do cliente.';
export function emailDeContaValido(e: string | null | undefined): boolean {
  return /^[^\s@,;:"'<>()]+@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(String(e || '').trim());
}

/** Emite o certificado de e-mail do Hestia (mail.<domínio> e o alias global de webmail). */
export async function issueMailLetsEncrypt(
  username: string,
  domain: string,
): Promise<{ ok: boolean; error?: string; output?: string }> {
  const result = await hestiaCall('v-add-letsencrypt-domain', [username, domain, '', 'yes'], {
    timeoutMs: 120_000,
    sshTimeoutMs: 120_000,
    sshFallbackOnTransportError: false,
  });
  return finishLetsEncrypt(result);
}

async function finishLetsEncrypt(
  result: Awaited<ReturnType<typeof hestiaCall>>,
): Promise<{ ok: boolean; error?: string; output?: string }> {
  if (!result.ok && !isAlreadyExistsError(result.error)) {
    return { ok: false, error: result.error };
  }

  // Pela API do Hestia (corre como root): no Contabo o site não é root, o `systemctl reload` falhava em silêncio e o
  // nginx só apanhava o certificado novo minutos depois (community.oshercollective.com, 14/10/2026).
  const proxy = await hestiaCall('v-restart-proxy', []).catch(() => ({ ok: false, error: 'sem resposta' }));
  const web = await hestiaCall('v-restart-web', []).catch(() => ({ ok: false, error: 'sem resposta' }));
  let reload = proxy.ok && web.ok ? 'ok' : '';
  if (!reload) {
    reload = await executeServerCommand(
      'systemctl reload nginx 2>&1 || sudo systemctl reload nginx 2>&1 || true',
    ).catch((e) => (e instanceof Error ? e.message : 'reload nginx falhou'));
  }

  return { ok: true, output: `Certificado SSL tratado. Reload nginx: ${reload || 'ok'}` };
}

export type HestiaPackage = { packageName: string };

/** O pacote pedido com o nome que ele tem no servidor (ex.: `vhost-pro` ou o antigo `VD-Host-Pro`); se não se encontra, o nome pedido (o servidor recusa). */
async function nomeDoPacoteNoServidor(pedido: string): Promise<string> {
  const achado = procurarPacote(pedido, (await listPackages()).map((p) => p.packageName));
  return 'nome' in achado ? achado.nome : pedido;
}

export async function listPackages(): Promise<HestiaPackage[]> {
  const result = await hestiaCallJson<Record<string, unknown>>('v-list-user-packages');
  if (!result.ok) return [];
  return Object.keys(result.data)
    .filter((name) => name !== 'system')
    .map((packageName) => ({ packageName }));
}

export async function createAccount(input: {
  username: string;
  password: string;
  email: string;
  domain: string;
  packageName: string;
  /** true = uma conta com este nome já existir é erro (nunca junta o domínio
   * a uma conta alheia) — usado nas contas próprias de domínios ligados. */
  requireNewUser?: boolean;
  /** Contas de onde o domínio pode passar sozinho para a conta nova se já existir no servidor (compra de
   * alojamento: a conta do administrador, onde ficam os sites da VisualDesign). Sem isto, um domínio que já
   * existe noutra conta continua a ser tolerado como "já existe" (comportamento antigo). */
  passarDeContas?: string[];
  /** Quem pediu (só para o registo da passagem em /root/vh-passagens) */
  quem?: string;
}): Promise<{ ok: boolean; error?: string; userExists?: boolean; aviso?: string; passou?: boolean }> {
  if (!emailDeContaValido(input.email)) return { ok: false, error: SEM_EMAIL };
  const userResult = await hestiaCall('v-add-user', [
    input.username,
    input.password,
    input.email,
    await nomeDoPacoteNoServidor(input.packageName),
  ]);
  if (!userResult.ok && isAlreadyExistsError(userResult.error) && input.requireNewUser) {
    return { ok: false, error: userResult.error, userExists: true };
  }
  if (!userResult.ok && !isAlreadyExistsError(userResult.error)) {
    return { ok: false, error: userResult.error };
  }

  // Domínio que já está noutra conta (plano 07-plano-passar-dominios-entre-contas.md, ponto 3):
  //  - na conta do administrador → passa para a conta nova, com tudo o que tem; o domínio só conta como feito
  //    depois de a passagem acabar bem (quem chama só avisa o cliente depois disto);
  //  - na conta de outro cliente → nunca passa sozinho: a conta fica criada sem o domínio e devolve-se um aviso
  //    para o administrador decidir.
  let passou = false;
  if (input.passarDeContas?.length) {
    const { dominioParaConta } = await import('@/lib/vhost-passar');
    const est = await dominioParaConta(input.username, input.domain, input.passarDeContas, input.quem || 'compra');
    // Um domínio que não consegue passar para a conta nova nunca impede a conta de existir (Silva, 29/10/2026: «o domínio estando noutra
    // conta não pode impedir criar a conta»): a conta fica criada e a equipa é avisada de que o domínio tem de ser passado.
    if (est.estado === 'falhou') {
      return { ok: true, aviso: `A conta ${input.username} ficou criada, mas o domínio ${input.domain} não passou para ela: ${est.erro} O administrador tem de o passar.` };
    }
    if (est.estado === 'noutra-conta') {
      return { ok: true, aviso: `O domínio ${input.domain} está na conta ${est.dono}; a conta ${input.username} ficou criada sem ele. O administrador tem de decidir.` };
    }
    passou = est.estado === 'passou';
  }

  if (!passou) {
    const domainResult = await hestiaCall('v-add-web-domain', [input.username, input.domain]);
    if (!domainResult.ok && !isAlreadyExistsError(domainResult.error)) {
      return { ok: false, error: domainResult.error };
    }
    // regra do webmail em https://<domínio>/webmail (só em domínios criados agora; os que passaram já a levam)
    if (domainResult.ok) {
      const { instalarWebmail } = await import('@/lib/vhost-passar');
      await instalarWebmail(input.username, input.domain).catch(() => false);
    }
  }

  // SSL best-effort — a conta e o domínio já ficam criados mesmo que o
  // Let's Encrypt falhe (ex.: DNS ainda não propagado); não bloqueia o
  // resultado da criação da conta em si. Correcção 1 set: isto tinha 'await'
  // apesar do comentário dizer o contrário — quando o domínio ainda não
  // resolve publicamente (normal logo a seguir à criação), a validação do
  // Let's Encrypt demora dezenas de segundos a falhar, e isso sozinho já
  // estourava o timeout de 30s do modal do painel (confirmado ao vivo:
  // "Timeout" no ecrã com o domínio afinal já criado com sucesso). Sem
  // 'await' para valer: a criação responde logo, e o certificado fica
  // pendente até o DNS apontar para cá (sem nenhum retentor automático
  // ainda — só resolve numa próxima chamada manual a este comando).
  pedirLetsEncryptPorTras(input.username, input.domain);

  // Mesma automação de SPF/DKIM/DMARC/Brevo que já corre ao criar um site no
  // DirectAdmin — sem isto, uma conta nova no Hestia ficava sempre sem
  // nenhuma configuração de email, mesmo quando a Cloudflare já tem zona
  // própria para o domínio. Import dinâmico evita ciclo com domain-email-auth.ts.
  const { runEmailDnsAutomation } = await import('@/lib/domain-email-auth');
  runEmailDnsAutomation(input.domain);

  return { ok: true, passou };
}

/** Remove só este site da conta (`v-delete-web-domain`) — nunca a conta em
 * si, mesmo quando `username` é a conta principal (ex.: "admin"), que fica
 * intacta com os restantes sites que tiver. */
/** Associa um domínio extra a uma conta Hestia já existente — equivalente ao
 * `createWebsite({ createUserAccount: false })` do DirectAdmin, usado por
 * `admin/domains/attach-hosting` para juntar um domínio a uma conta que já
 * tem hospedagem. Idempotente: já-existe conta como sucesso. */
export async function addWebDomain(username: string, domain: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-add-web-domain', [username, domain]);
  if (!result.ok && !isAlreadyExistsError(result.error)) return { ok: false, error: result.error };
  // SSL best-effort, sem bloquear a resposta — ver comentário em createAccount().
  pedirLetsEncryptPorTras(username, domain);
  const { runEmailDnsAutomation } = await import('@/lib/domain-email-auth');
  runEmailDnsAutomation(domain);
  return { ok: true };
}

export async function deleteWebDomain(username: string, domain: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-delete-web-domain', [username, domain]);
  if (result.ok) {
    const { runEmailDnsCleanup } = await import('@/lib/domain-email-auth');
    runEmailDnsCleanup(domain);
  }
  return { ok: result.ok, error: result.error };
}

/** Suspende só este site (não a conta) — equivalente ao `da suspend-domain`
 * do DirectAdmin. Nunca testado ao vivo neste servidor; confirmar antes de
 * confiar nisto para clientes reais. */
export async function suspendWebDomain(username: string, domain: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-suspend-web-domain', [username, domain]);
  return { ok: result.ok, error: result.error };
}

export async function unsuspendWebDomain(username: string, domain: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-unsuspend-web-domain', [username, domain]);
  return { ok: result.ok, error: result.error };
}

/** Suspende só o email deste domínio (caixas deixam de receber/enviar), sem
 * tocar no site nem no resto da conta — planos de email expirados. Mesmo
 * aviso do suspendWebDomain: ainda não testado ao vivo neste servidor. */
export async function suspendMailDomain(username: string, domain: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-suspend-mail-domain', [username, domain]);
  return { ok: result.ok, error: result.error };
}

export async function unsuspendMailDomain(username: string, domain: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-unsuspend-mail-domain', [username, domain]);
  return { ok: result.ok, error: result.error };
}

export async function suspendAccount(username: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-suspend-user', [username]);
  return { ok: result.ok, error: result.error };
}

export async function unsuspendAccount(username: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-unsuspend-user', [username]);
  return { ok: result.ok, error: result.error };
}

export async function deleteAccount(username: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-delete-user', [username]);
  // Sem resposta a tempo: o pedido pode ter corrido na mesma. Se a conta já não existe no servidor, está apagada.
  if (!result.ok && result.exitCode === -1) {
    const ainda = await hestiaCall('v-list-user', [username, 'json']);
    if (!ainda.ok) return { ok: true };
  }
  return { ok: result.ok, error: result.error };
}

/** Atribui um pacote JÁ EXISTENTE no Hestia a uma conta. Criar/editar os
 * limites de um pacote (disco, contas de email/BD, etc.) não tem um comando
 * CLI directo no Hestia — exige gerar um ficheiro de definição do pacote
 * (`v-add-user-package TMPFILE PACKAGE`) ou editar `$HESTIA/data/packages/*.pkg`
 * directamente por SSH; não implementado aqui de propósito (ver nota no plano). */
export async function changeUserPackage(
  username: string,
  packageName: string,
  /** descer de plano: aceita o pacote mesmo que a conta já use mais do que ele deixa (FORCE do Hestia). A conta fica
   *  com tudo o que já tem; só não pode criar mais até ficar dentro dos limites. */
  forcar = false,
): Promise<{ ok: boolean; error?: string; limite?: boolean }> {
  const result = await hestiaCall('v-change-user-package', [username, packageName, ...(forcar ? ['yes'] : [])]);
  // Código 8 do Hestia (limite): a conta já usa mais do que o pacote novo deixa (domínios, e-mails, bases de dados…).
  // Foi o que aconteceu ao passar contas com site para o VD-Email-Basico (registo do servidor, 12 e 14/10/2026).
  const respostaPacote = `${result.error || ''}\n${result.output || ''}`;
  if (result.exitCode === 8 || /limit|doesn't cover/i.test(respostaPacote)) {
    // O que não cabe, dito pelo Hestia ("Package doesn't cover DATABASE usage"). Não é "descer de plano": passar do
    // e-mail para o VD-Host-Basico é subir, mas o mltmark tem 2 bases de dados e o pacote deixa 1 (Silva, 17/10/2026).
    const NOMES: Record<string, string> = { DATABASE: 'bases de dados', WEB_DOMAINS: 'sites', WEB: 'sites', DNS_DOMAINS: 'domínios DNS', DNS: 'domínios DNS', MAIL_DOMAINS: 'domínios de e-mail', MAIL_ACCOUNTS: 'contas de e-mail', MAIL: 'contas de e-mail', CRON_JOBS: 'tarefas cron', DISK: 'espaço em disco', BANDWIDTH: 'tráfego' };
    const recurso = respostaPacote.match(/doesn't cover (\w+) usage/i)?.[1]?.toUpperCase() || '';
    const oQue = NOMES[recurso] || 'domínios, e-mails ou bases de dados';
    return {
      ok: false,
      limite: true,
      error: forcar
        ? `o servidor continua a recusar o pacote ${packageName} para a conta ${username}: ${respostaPacote.trim() || 'limite de recursos excedido'}`
        : `o pacote ${packageName} não chega para o que a conta ${username} já tem (${oQue})`,
    };
  }
  if (!result.ok) return { ok: result.ok, error: result.error };
  // Confirma no servidor que o pacote mudou mesmo: sem o cabeçalho com o código de saída, a API do Hestia pode
  // responder "200" a um pedido recusado, e o painel dizia "alterado" sem nada mudar (Silva, 16/10/2026).
  const lido = await hestiaCall('v-list-user', [username, 'json']);
  if (!lido.ok) {
    return {
      ok: false,
      error: `o pacote foi enviado ao servidor, mas não foi possível confirmar se a conta ${username} passou para ${packageName}: ${lido.error || 'falha ao consultar a conta'}. Actualize a lista antes de repetir.`,
    };
  }
  let atual: string | undefined;
  try {
    const j = JSON.parse(lido.output) as Record<string, { PACKAGE?: string }>;
    atual = j[username]?.PACKAGE;
  } catch {
    return {
      ok: false,
      error: `o pacote foi enviado ao servidor, mas a resposta de confirmação da conta ${username} não é válida. Actualize a lista antes de repetir.`,
    };
  }
  if (!atual) {
    return {
      ok: false,
      error: `o pacote foi enviado ao servidor, mas não foi possível ler o pacote actual da conta ${username}. Actualize a lista antes de repetir.`,
    };
  }
  if (atual !== packageName) {
    return {
      ok: false,
      error: `o servidor não mudou o pacote da conta ${username} (continua ${atual})${result.output ? ': ' + result.output : ''}`,
    };
  }
  return { ok: true };
}

export async function changePassword(
  username: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-change-user-password', [username, password]);
  return { ok: result.ok, error: result.error };
}

/** Confirma a password de uma conta (`v-check-user-password`) — é a "chave"
 * pedida para entrar numa conta de domínio ligada (plano Premium). Só conta o
 * código de saída real da API (0 = certa). Se a API cair para o SSH, o
 * sucesso não imprime nada e o resultado fica `ok: false` — falha fechada,
 * nunca deixa entrar com uma password errada. */
export async function checkUserPassword(
  username: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!username || !password.trim()) return { ok: false, error: 'Credenciais em falta.' };
  // codigoDeSaida: sem isto a API responde 200 mesmo com a palavra-passe errada (ver hestia-client)
  const result = await hestiaCall('v-check-user-password', [username, password], { codigoDeSaida: true });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/** Limite de domínios web de cada pacote (nome em minúsculas → limite; null =
 * sem limite). Mapa vazio quando o Hestia não responde. */
export async function listPackageDomainLimits(): Promise<Map<string, number | null>> {
  const limits = new Map<string, number | null>();
  const result = await hestiaCallJson<Record<string, Record<string, string>>>('v-list-user-packages');
  if (!result.ok) return limits;
  for (const [name, pkg] of Object.entries(result.data)) {
    if (name === 'system') continue;
    limits.set(name.toLowerCase(), parseHestiaLimit(pkg?.WEB_DOMAINS));
  }
  return limits;
}

export type HestiaPackageDetails = {
  packageName: string;
  /** null = ilimitado */
  webDomains: number | null;
  mailAccounts: number | null;
  databases: number | null;
  diskQuotaMb: number | null;
  bandwidthMb: number | null;
};

/** Pacotes com os limites reais (v-list-user-packages) — leitura directa,
 * sem passar pela tabela panel_packages. */
export async function listPackagesDetailed(): Promise<HestiaPackageDetails[]> {
  const result = await hestiaCallJson<Record<string, Record<string, string>>>('v-list-user-packages');
  if (!result.ok) return [];
  return Object.entries(result.data)
    .filter(([name]) => name !== 'system')
    .map(([packageName, pkg]) => ({
      packageName,
      webDomains: parseHestiaLimit(pkg?.WEB_DOMAINS),
      mailAccounts: parseHestiaLimit(pkg?.MAIL_ACCOUNTS),
      databases: parseHestiaLimit(pkg?.DATABASES),
      diskQuotaMb: parseHestiaLimit(pkg?.DISK_QUOTA),
      bandwidthMb: parseHestiaLimit(pkg?.BANDWIDTH),
    }));
}

export type HestiaUser = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  packageName: string;
  suspended: boolean;
  diskUsedMb: number;
  bandwidthUsedMb: number;
  diskLimitMb: number | null;
  bandwidthLimitMb: number | null;
};

function parseHestiaLimit(value: string | undefined): number | null {
  if (!value || value.toLowerCase() === 'unlimited') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseHestiaUsage(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lista todas as contas reais do Hestia (equivalente a `listAllHostingUsersFromDa`
 * do DirectAdmin) — usado pelo hestia-sync para espelhar o estado real do
 * servidor no Supabase. Exclui o próprio utilizador de login da API
 * (HESTIA_USER, ex: 'vdadmin'), que não é uma conta de cliente.
 */
export async function listUsers(): Promise<HestiaUser[]> {
  const result = await hestiaCallJson<Record<string, Record<string, string>>>('v-list-users');
  if (!result.ok) return [];
  const apiUser = (process.env.HESTIA_USER || 'vdadmin').trim();
  return Object.entries(result.data)
    .filter(([username]) => username !== apiUser)
    .map(([username, u]) => ({
      username,
      email: u.EMAIL || '',
      firstName: u.FNAME || '',
      lastName: u.LNAME || '',
      packageName: u.PACKAGE || '',
      suspended: (u.SUSPENDED || 'no').toLowerCase() === 'yes',
      diskUsedMb: parseHestiaUsage(u.U_DISK),
      bandwidthUsedMb: parseHestiaUsage(u.U_BANDWIDTH),
      diskLimitMb: parseHestiaLimit(u.DISK_QUOTA),
      // #campo-real: v-list-users devolve "BANDWIDTH", não "BANDWIDTH_QUOTA"
      // (confirmado directamente na resposta real do servidor) — o nome
      // errado fazia isto ser sempre null, mesmo com quota real definida.
      bandwidthLimitMb: parseHestiaLimit(u.BANDWIDTH),
    }));
}

export type HestiaWebDomain = {
  domain: string;
  ip: string;
  suspended: boolean;
  sslEnabled: boolean;
  diskUsedMb: number;
  bandwidthUsedMb: number;
};

/** Lista os domínios/websites reais de uma conta Hestia (equivalente a `da.listWebsites()` filtrado por dono). */
export async function listWebDomains(username: string): Promise<HestiaWebDomain[]> {
  const result = await hestiaCallJson<Record<string, Record<string, string>>>('v-list-web-domains', [username]);
  // Nunca devolver [] num falhanço — o hestia-sync-engine usa uma lista vazia
  // como "esta conta não tem sites nenhuns" para apagar do espelho tudo o que
  // já lá estava (fora do período de graça). Uma falha transitória a falar com
  // a Hestia (timeout, blip de rede) parecia sucesso-com-zero-sites, e apagava
  // o entrecamposblog.com (e potencialmente todos os outros sites do vdadmin)
  // do painel sem o domínio ter mudado nada a sério no servidor. Confirmado ao
  // vivo 1 set — reapareceu depois de repor à mão e desapareceu outra vez pouco
  // depois, sem eu ter tocado em nada. Atirar o erro deixa o try/catch já
  // existente no chamador (sync e hosting-resolver) tratar isto como "esta
  // conta falhou", nunca como "conta sem sites".
  if (!result.ok) throw new Error(result.error || 'Falha ao listar domínios no Vhost');
  return Object.entries(result.data).map(([domain, d]) => ({
    domain,
    ip: d.IP || '',
    suspended: (d.SUSPENDED || 'no').toLowerCase() === 'yes',
    sslEnabled: (d.SSL || 'no').toLowerCase() !== 'no' && Boolean(d.SSL),
    diskUsedMb: parseHestiaUsage(d.U_DISK),
    bandwidthUsedMb: parseHestiaUsage(d.U_BANDWIDTH),
  }));
}

// ---------------------------------------------------------------------------
// Bases de dados — confirmado directamente no servidor (ssh, bin/v-add-database
// etc, 2026-08-11): v-add-database USER DBNAME DBUSER DBPASS [TYPE] [HOST]
// [CHARSET] cria `${USER}_${DBNAME}`/`${USER}_${DBUSER}` (o Hestia junta o
// prefixo sozinho — nunca enviar o nome já prefixado para "criar"). Delete e
// change-password já exigem o nome completo (tal como devolvido por listDatabases).
// ---------------------------------------------------------------------------

export type HestiaDatabase = {
  database: string;
  dbUser: string;
  host: string;
  type: string;
  charset: string;
  diskUsedMb: number;
  suspended: boolean;
};

export async function listDatabases(username: string): Promise<HestiaDatabase[]> {
  const result = await hestiaCallJson<Record<string, Record<string, string>>>('v-list-databases', [username]);
  if (!result.ok) return [];
  return Object.entries(result.data).map(([database, d]) => ({
    database,
    dbUser: d.DBUSER || '',
    host: d.HOST || '',
    type: d.TYPE || 'mysql',
    charset: d.CHARSET || '',
    diskUsedMb: parseHestiaUsage(d.U_DISK),
    suspended: (d.SUSPENDED || 'no').toLowerCase() === 'yes',
  }));
}

function sanitizeDbSuffix(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_]/g, '').slice(0, 32);
}

function assertSqlIdent(name: string): string {
  if (!name || !/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error('Nome de base de dados inválido.');
  }
  return name;
}

export async function createDatabase(input: {
  username: string;
  dbNameSuffix: string;
  dbUserSuffix: string;
  password: string;
  charset?: string;
}): Promise<{ ok: boolean; error?: string; database?: string; dbUser?: string }> {
  const dbNameSuffix = sanitizeDbSuffix(input.dbNameSuffix);
  const dbUserSuffix = sanitizeDbSuffix(input.dbUserSuffix || dbNameSuffix);
  if (!dbNameSuffix || !dbUserSuffix) {
    return { ok: false, error: 'Nome da base de dados inválido. Use só letras, números e underscore.' };
  }
  const args = [input.username, dbNameSuffix, dbUserSuffix, input.password];
  const charset = (input.charset || '').replace(/[^A-Za-z0-9_]/g, '');
  if (charset) args.push('mysql', 'localhost', charset);
  const result = await hestiaCall('v-add-database', args);
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    database: `${input.username}_${dbNameSuffix}`,
    dbUser: `${input.username}_${dbUserSuffix}`,
  };
}

type MysqlSchemaStats = {
  collation: string;
  tableCount: number;
  viewCount: number;
  eventCount: number;
  triggerCount: number;
  routineCount: number;
  sizeBytes: number;
};

async function mysqlSchemaStats(database: string): Promise<MysqlSchemaStats> {
  const id = assertSqlIdent(database);
  const sql = [
    `SELECT IFNULL((SELECT DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${id}'),'')`,
    `IFNULL((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${id}' AND TABLE_TYPE='BASE TABLE'),0)`,
    `IFNULL((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${id}' AND TABLE_TYPE='VIEW'),0)`,
    `IFNULL((SELECT COUNT(*) FROM information_schema.EVENTS WHERE EVENT_SCHEMA='${id}'),0)`,
    `IFNULL((SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA='${id}'),0)`,
    `IFNULL((SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA='${id}'),0)`,
    `IFNULL((SELECT SUM(DATA_LENGTH+INDEX_LENGTH) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${id}'),0)`,
  ].join(', ');
  const raw = await executeServerCommand(`mysql -N -e "${sql}" 2>/dev/null`);
  const parts = raw.trim().split(/\s+/);
  const n = (i: number) => Number(parts[i] || 0) || 0;
  return {
    collation: parts[0] || '',
    tableCount: n(1),
    viewCount: n(2),
    eventCount: n(3),
    triggerCount: n(4),
    routineCount: n(5),
    sizeBytes: n(6),
  };
}

export type HestiaDatabaseDetails = {
  database: string;
  dbUser: string;
  host: string;
  type: string;
  defaultCharset: string;
  defaultCollation: string;
  sizeBytes: number;
  userCount: number;
  tableCount: number;
  viewCount: number;
  eventCount: number;
  triggerCount: number;
  routineCount: number;
  suspended: boolean;
};

export async function getDatabaseDetails(
  username: string,
  database: string,
): Promise<HestiaDatabaseDetails | null> {
  const id = assertSqlIdent(database);
  const admin = username.toLowerCase() === (process.env.HESTIA_USER || 'vdadmin').trim().toLowerCase();
  if (!admin && !id.startsWith(`${username}_`)) return null;
  const listed = await listDatabases(username);
  const row = listed.find((d) => d.database === id);
  const exists = await executeServerCommand(
    `mysql -N -e "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${id}'"`,
  ).then((raw) => raw.trim() === id).catch(() => Boolean(row));
  if (!row && !exists) return null;
  let stats: MysqlSchemaStats = {
    collation: '',
    tableCount: 0,
    viewCount: 0,
    eventCount: 0,
    triggerCount: 0,
    routineCount: 0,
    sizeBytes: row ? row.diskUsedMb * 1024 * 1024 : 0,
  };
  try {
    stats = await mysqlSchemaStats(id);
  } catch {
    if (!row) return null;
  }
  return {
    database: id,
    dbUser: row?.dbUser || '',
    host: row?.host || 'localhost',
    type: row?.type || 'mysql',
    defaultCharset: row?.charset || 'utf8mb4',
    defaultCollation: stats.collation || 'utf8mb4_unicode_ci',
    sizeBytes: stats.sizeBytes || (row ? row.diskUsedMb * 1024 * 1024 : 0),
    userCount: 1,
    tableCount: stats.tableCount,
    viewCount: stats.viewCount,
    eventCount: stats.eventCount,
    triggerCount: stats.triggerCount,
    routineCount: stats.routineCount,
    suspended: row?.suspended || false,
  };
}

/** No Hestia 1 base = 1 utilizador. A UI DA espera uma lista. */
export function hestiaDatabaseUsers(row: { database: string; dbUser: string; host: string }) {
  return [
    {
      dbuser: row.dbUser,
      hostPatterns: [row.host || 'localhost'],
      privileges: {
        alter: true,
        alterRoutine: true,
        create: true,
        createRoutine: true,
        createTmpTable: true,
        createView: true,
        delete: true,
        drop: true,
        event: true,
        execute: true,
        index: true,
        insert: true,
        lockTables: true,
        references: true,
        select: true,
        showView: true,
        trigger: true,
        update: true,
      },
    },
  ];
}

function mysqlViaStdin(sql: string): Promise<string> {
  const b64 = Buffer.from(sql, 'utf8').toString('base64');
  const marker = '__MYSQL_OK__';
  return executeServerCommand(
    `echo '${b64}' | base64 -d | mysql --batch --raw --default-character-set=utf8mb4 && echo ${marker}`,
  ).then((out) => {
    if (!out.includes(marker) || /ERROR\s+\d+/i.test(out)) {
      throw new Error(out.replace(marker, '').trim() || 'MySQL falhou.');
    }
    return out.replace(marker, '').trim();
  });
}

export async function exportDatabaseFile(
  database: string,
  gzip: boolean,
): Promise<{ ok: boolean; filePath?: string; error?: string }> {
  let id: string;
  try {
    id = assertSqlIdent(database);
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Nome inválido' };
  }
  const tmp = `/tmp/vd-dump-${process.pid}-${Date.now()}.${gzip ? 'sql.gz' : 'sql'}`;
  const dump = `mysqldump --single-transaction --quick --hex-blob --routines --triggers --default-character-set=utf8mb4 ${id}`;
  const cmd = gzip ? `${dump} | gzip -c > ${tmp}` : `${dump} > ${tmp}`;
  try {
    // o resultado vai numa marca com o código (EXPRES:0 = ficheiro criado e não vazio): num servidor que corre os
    // comandos localmente, um comando que falha devolve o texto do próprio comando e antes isto dava sempre sucesso
    const saida = await executeServerCommand(`${cmd} && test -s ${tmp}; echo "EXPRES:$?"`);
    if (!/^EXPRES:0\s*$/m.test(saida)) {
      await executeServerCommand(`rm -f ${tmp}`).catch(() => '');
      return { ok: false, error: saida.replace(/^EXPRES:\d+\s*$/m, '').trim() || 'Exportação falhou' };
    }
    return { ok: true, filePath: tmp };
  } catch (e: unknown) {
    await executeServerCommand(`rm -f ${tmp}`).catch(() => '');
    return { ok: false, error: e instanceof Error ? e.message : 'Exportação falhou' };
  }
}

export async function exportDatabaseBytes(
  database: string,
  gzip: boolean,
): Promise<{ ok: boolean; bytes?: Buffer; error?: string }> {
  const dumped = await exportDatabaseFile(database, gzip);
  if (!dumped.ok || !dumped.filePath) return { ok: false, error: dumped.error };
  const tmp = dumped.filePath;
  try {
    const fs = await import('fs/promises');
    try {
      const bytes = await fs.readFile(tmp);
      if (bytes.length) return { ok: true, bytes };
    } catch {
      /* o dump vive no servidor de hospedagem — ler via SSH */
    }
    const b64 = await executeServerCommand(`base64 ${tmp}`);
    const bytes = Buffer.from(b64.replace(/\s+/g, ''), 'base64');
    if (!bytes.length) return { ok: false, error: 'Dump vazio.' };
    return { ok: true, bytes };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Exportação falhou' };
  } finally {
    await executeServerCommand(`rm -f ${tmp}`).catch(() => '');
  }
}

export async function importDatabaseFile(
  database: string,
  sql: Buffer,
  clean: boolean,
  fileName = '',
): Promise<{ ok: boolean; error?: string }> {
  let id: string;
  try {
    id = assertSqlIdent(database);
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Nome inválido' };
  }
  const { uploadFileViaSsh } = await import('@/lib/server-ssh-exec');
  const stamp = `${process.pid}-${Date.now()}`;
  const isGz =
    /\.gz$/i.test(fileName) || (sql.length >= 2 && sql[0] === 0x1f && sql[1] === 0x8b);
  const isZip =
    /\.zip$/i.test(fileName) || (sql.length >= 2 && sql[0] === 0x50 && sql[1] === 0x4b);
  const remote = isGz
    ? `/tmp/vd-import-${stamp}.sql.gz`
    : isZip
      ? `/tmp/vd-import-${stamp}.zip`
      : `/tmp/vd-import-${stamp}.sql`;
  try {
    await uploadFileViaSsh(remote, sql);
    if (clean) {
      await mysqlViaStdin(
        [
          'SET FOREIGN_KEY_CHECKS=0;',
          'SET SESSION group_concat_max_len=10485760;',
          `SET @drop = (SELECT CONCAT('DROP TABLE IF EXISTS ', GROUP_CONCAT(CONCAT('\`', table_name, '\`'))) FROM information_schema.tables WHERE table_schema='${id}' AND table_type='BASE TABLE');`,
          "SET @drop = IFNULL(@drop, 'SELECT 1');",
          'PREPARE stmt FROM @drop; EXECUTE stmt; DEALLOCATE PREPARE stmt;',
          'SET FOREIGN_KEY_CHECKS=1;',
        ].join(' '),
      );
    }
    const marker = '__MYSQL_OK__';
    const load = isGz
      ? `gunzip -c ${remote} | mysql --default-character-set=utf8mb4 ${id}`
      : isZip
        ? `SQLFILE=$(unzip -Z -1 ${remote} | grep -i '\\.sql$' | head -1) && unzip -p ${remote} "$SQLFILE" | mysql --default-character-set=utf8mb4 ${id}`
        : `mysql --default-character-set=utf8mb4 ${id} < ${remote}`;
    const out = await executeServerCommand(`${load} && echo ${marker}`, { timeoutMs: 600_000 });
    if (!out.includes(marker) || /ERROR\s+\d+/i.test(out.replace(marker, ''))) {
      throw new Error(out.replace(marker, '').trim() || 'Importação falhou.');
    }
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Importação falhou' };
  } finally {
    await executeServerCommand(`rm -f ${remote}`).catch(() => '');
  }
}

export async function maintainDatabase(
  database: string,
  op: 'check' | 'repair' | 'optimize',
): Promise<{ ok: boolean; error?: string; data?: string }> {
  let id: string;
  try {
    id = assertSqlIdent(database);
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Nome inválido' };
  }
  const verb = op === 'check' ? 'CHECK' : op === 'repair' ? 'REPAIR' : 'OPTIMIZE';
  try {
    const rawTables = await executeServerCommand(
      `mysql -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema='${id}' AND table_type='BASE TABLE'"`,
    );
    const tables = rawTables
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `\`${id}\`.\`${assertSqlIdent(t)}\``);
    if (!tables.length) return { ok: true, data: 'Nenhuma tabela nesta base de dados.' };
    const output = await mysqlViaStdin(`${verb} TABLE ${tables.join(',')}`);
    return { ok: true, data: output || `${verb} concluído.` };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Operação falhou' };
  }
}

export function phpMyAdminUrl(domain?: string): string {
  return getPhpMyAdminUrl(domain);
}

/** `database` tem de vir já com o prefixo `${username}_` (como devolvido por listDatabases). */
export async function deleteDatabase(username: string, database: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-delete-database', [username, database]);
  return { ok: result.ok, error: result.error };
}

export async function changeDatabasePassword(
  username: string,
  database: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-change-database-password', [username, database, password]);
  return { ok: result.ok, error: result.error };
}

export async function refreshDatabaseDisk(
  username: string,
  database: string,
): Promise<void> {
  await hestiaCall('v-update-database-disk', [username, database]);
}

// ---------------------------------------------------------------------------
// Email — confirmado no servidor: uma conta de email exige primeiro um "mail
// domain" (v-add-mail-domain, idempotente aqui via isAlreadyExistsError) antes
// de v-add-mail-account. Sufixo/quota tal como documentado no CLI oficial.
// ---------------------------------------------------------------------------

export async function addMailDomain(username: string, domain: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-add-mail-domain', [username, domain]);
  if (!result.ok && !isAlreadyExistsError(result.error)) return { ok: false, error: result.error };
  return { ok: true };
}

/** Domínios de email de uma conta. Atira em falha (como listWebDomains) para
 * nunca confundir "falhou" com "não tem domínios". */
export async function listMailDomains(username: string): Promise<string[]> {
  const result = await hestiaCallJson<Record<string, Record<string, string>>>('v-list-mail-domains', [username]);
  if (!result.ok) throw new Error(result.error || 'Falha ao listar domínios de email no Vhost');
  return Object.keys(result.data);
}

export type HestiaMailAccount = {
  account: string;
  quotaMb: number | null;
  diskUsedMb: number;
};

export async function listMailAccounts(username: string, domain: string): Promise<HestiaMailAccount[]> {
  const result = await hestiaCallJson<Record<string, Record<string, string>>>('v-list-mail-accounts', [username, domain]);
  if (!result.ok) return [];
  return Object.entries(result.data).map(([account, a]) => ({
    account,
    quotaMb: parseHestiaLimit(a.QUOTA),
    diskUsedMb: parseHestiaUsage(a.U_DISK),
  }));
}

export async function addMailAccount(
  username: string,
  domain: string,
  account: string,
  password: string,
  quotaMb?: number,
): Promise<{ ok: boolean; error?: string }> {
  const domainStep = await addMailDomain(username, domain);
  if (!domainStep.ok) return domainStep;
  const args = [username, domain, account, password];
  if (quotaMb) args.push(String(quotaMb));
  const result = await hestiaCall('v-add-mail-account', args);
  return { ok: result.ok, error: result.error };
}

export async function deleteMailAccount(
  username: string,
  domain: string,
  account: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-delete-mail-account', [username, domain, account]);
  return { ok: result.ok, error: result.error };
}

export async function changeMailAccountPassword(
  username: string,
  domain: string,
  account: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-change-mail-account-password', [username, domain, account, password]);
  return { ok: result.ok, error: result.error };
}

/** Confirmado no servidor (bin/v-change-mail-account-quota, 2026-08-27):
 * `v-change-mail-account-quota USER DOMAIN ACCOUNT QUOTA`. */
export async function changeMailAccountQuota(
  username: string,
  domain: string,
  account: string,
  quotaMb: number,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-change-mail-account-quota', [username, domain, account, String(quotaMb)]);
  return { ok: result.ok, error: result.error };
}

export async function suspendMailAccount(
  username: string,
  domain: string,
  account: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-suspend-mail-account', [username, domain, account]);
  return { ok: result.ok, error: result.error };
}

export async function unsuspendMailAccount(
  username: string,
  domain: string,
  account: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-unsuspend-mail-account', [username, domain, account]);
  return { ok: result.ok, error: result.error };
}

function parseHestiaForwardList(raw: unknown): string[] {
  const value = String(raw ?? '').trim();
  if (!value || /^(no|n\/a|none|null)$/i.test(value)) return [];
  return value
    .split(/[,;]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.includes('@'));
}

function hestiaRecordField(data: Record<string, unknown>, key: string, nestedKey?: string): unknown {
  if (data[key] != null) return data[key];
  if (nestedKey && data[nestedKey] && typeof data[nestedKey] === 'object') {
    return (data[nestedKey] as Record<string, unknown>)[key];
  }
  const first = Object.values(data)[0];
  if (first && typeof first === 'object') return (first as Record<string, unknown>)[key];
  return undefined;
}

export async function addMailForward(
  username: string,
  domain: string,
  account: string,
  forwardTo: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-add-mail-account-forward', [username, domain, account, forwardTo]);
  if (!result.ok && !isAlreadyExistsError(result.error)) return { ok: false, error: result.error };
  return { ok: true };
}

export async function deleteMailForward(
  username: string,
  domain: string,
  account: string,
  forwardTo: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-delete-mail-account-forward', [username, domain, account, forwardTo]);
  return { ok: result.ok, error: result.error };
}

export async function listMailAccountForwards(
  username: string,
  domain: string,
  account: string,
): Promise<{ ok: boolean; forwards: string[]; error?: string }> {
  const result = await hestiaCallJson<Record<string, unknown>>('v-list-mail-account', [username, domain, account]);
  if (!result.ok) return { ok: false, forwards: [], error: result.error };
  return {
    ok: true,
    forwards: parseHestiaForwardList(hestiaRecordField(result.data, 'FWD', account) ?? hestiaRecordField(result.data, 'FORWARD', account)),
  };
}

export async function getMailDomainCatchall(
  username: string,
  domain: string,
): Promise<{ ok: boolean; catchall: string; error?: string }> {
  const result = await hestiaCallJson<Record<string, unknown>>('v-list-mail-domain', [username, domain]);
  if (!result.ok) return { ok: false, catchall: '', error: result.error };
  const raw = String(hestiaRecordField(result.data, 'CATCHALL', domain) ?? '').trim();
  if (!raw || /^(no|n\/a|none|null|disabled)$/i.test(raw) || raw.startsWith(':')) {
    return { ok: true, catchall: '' };
  }
  return { ok: true, catchall: raw };
}

export async function setMailDomainCatchall(
  username: string,
  domain: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const domainStep = await addMailDomain(username, domain);
  if (!domainStep.ok) return domainStep;
  const target = email.trim();
  if (!target) {
    const result = await hestiaCall('v-delete-mail-domain-catchall', [username, domain]);
    if (!result.ok && /exist|found|no such/i.test(result.error || '')) return { ok: true };
    return { ok: result.ok, error: result.error };
  }
  const added = await hestiaCall('v-add-mail-domain-catchall', [username, domain, target]);
  if (added.ok || isAlreadyExistsError(added.error)) {
    if (added.ok) return { ok: true };
    const changed = await hestiaCall('v-change-mail-domain-catchall', [username, domain, target]);
    if (changed.ok || isAlreadyExistsError(changed.error)) return { ok: true };
    return { ok: false, error: changed.error || added.error };
  }
  const changed = await hestiaCall('v-change-mail-domain-catchall', [username, domain, target]);
  if (changed.ok || isAlreadyExistsError(changed.error)) return { ok: true };
  return { ok: false, error: added.error || changed.error };
}

// ---------------------------------------------------------------------------
// DNS — confirmado no servidor (bin/v-add-dns-domain e afins, 2026-08-31,
// testado com uma zona descartável .invalid antes de assumir a sintaxe).
// Isto é o servidor de nomes PRÓPRIO do Hestia (ns3/ns4.visualdesignmoz.com)
// — só afecta a resolução real de um domínio se os nameservers dele
// apontarem para aqui. Nenhum domínio real tinha zona criada em 31 ago
// (nem oshercollective nem vdadmin) — criar uma zona aqui não muda nada
// visível até alguém mudar os nameservers do domínio de verdade, decisão
// fora do código.
// ---------------------------------------------------------------------------

/** IP público deste servidor — obrigatório para v-add-dns-domain, não é
 * segredo (mesmo IP já usado nos vhosts nginx do Contabo). */
const HESTIA_SERVER_IP = '169.58.148.144';

/** v-add-dns-domain semeia sempre ~15 registos por omissão (NS, A do
 * domínio e do "mail", CNAME www/ftp/webmail, MX, SPF, DMARC, SRV de
 * autoconfig de email) — idêntico ao que os outros v-add-* já fazem aqui. */
export async function addDnsZone(username: string, domain: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-add-dns-domain', [username, domain, HESTIA_SERVER_IP]);
  if (!result.ok && !isAlreadyExistsError(result.error)) return { ok: false, error: result.error };
  return { ok: true };
}

export async function deleteDnsZone(username: string, domain: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-delete-dns-domain', [username, domain]);
  return { ok: result.ok, error: result.error };
}

export type HestiaDnsRecord = {
  id: string;
  record: string;
  type: string;
  value: string;
  priority: string;
  ttl: number;
};

export async function listDnsRecords(username: string, domain: string): Promise<HestiaDnsRecord[]> {
  const result = await hestiaCallJson<Record<string, Record<string, string>>>('v-list-dns-records', [username, domain]);
  if (!result.ok) return [];
  return Object.entries(result.data).map(([id, r]) => ({
    id,
    record: r.RECORD || '@',
    type: (r.TYPE || 'A').toUpperCase(),
    value: r.VALUE || '',
    priority: r.PRIORITY || '',
    ttl: Number(r.TTL) || 14400,
  }));
}

/** `record`: "@" para o próprio domínio, ou o nome relativo (ex.: "www",
 * "blog") — nunca o domínio completo nem com ponto final (confirmado no
 * servidor: v-add-dns-record guarda exactamente o que se lhe dá, sem
 * normalizar). Cria a zona primeiro se ainda não existir (idempotente,
 * mesmo padrão de addMailAccount a criar o mail domain primeiro). */
export async function addDnsRecord(
  username: string,
  domain: string,
  record: string,
  type: string,
  value: string,
  ttl?: number,
  priority?: string,
): Promise<{ ok: boolean; error?: string }> {
  const zoneStep = await addDnsZone(username, domain);
  if (!zoneStep.ok) return zoneStep;
  const args = [
    username,
    domain,
    record || '@',
    type.toUpperCase(),
    value,
    priority || '',
    '',
    '',
    String(ttl || 14400),
  ];
  const result = await hestiaCall('v-add-dns-record', args);
  return { ok: result.ok, error: result.error };
}

export async function deleteDnsRecord(
  username: string,
  domain: string,
  recordId: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-delete-dns-record', [username, domain, recordId]);
  return { ok: result.ok, error: result.error };
}

// ---------------------------------------------------------------------------
// FTP — confirmado no servidor (bin/v-add-web-domain-ftp e afins, 2026-08-11):
// contas FTP são sempre associadas a um domínio (não existe FTP "solto" da
// conta), e não há v-list-web-domain-ftp — a lista vem embutida nos campos
// FTP_USER/FTP_PATH (separados por vírgula) do próprio v-list-web-domain.
// ---------------------------------------------------------------------------

export type HestiaFtpAccount = { ftpUser: string; path: string };

export async function listFtpAccounts(username: string, domain: string): Promise<HestiaFtpAccount[]> {
  const result = await hestiaCallJson<Record<string, Record<string, string>>>('v-list-web-domain', [username, domain]);
  if (!result.ok) return [];
  const fields = result.data[domain];
  if (!fields) return [];
  const users = (fields.FTP_USER || '').split(',').map((s) => s.trim()).filter(Boolean);
  const paths = (fields.FTP_PATH || '').split(',').map((s) => s.trim());
  return users.map((ftpUser, i) => ({ ftpUser, path: paths[i] || '' }));
}

export async function addFtpAccount(
  username: string,
  domain: string,
  ftpUserSuffix: string,
  password: string,
  path?: string,
): Promise<{ ok: boolean; error?: string; ftpUser?: string }> {
  const args = [username, domain, ftpUserSuffix, password];
  if (path) args.push(path);
  const result = await hestiaCall('v-add-web-domain-ftp', args);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, ftpUser: `${username}_${ftpUserSuffix}` };
}

/** `ftpUser` tem de vir já com o prefixo `${username}_` (como devolvido por listFtpAccounts). */
export async function deleteFtpAccount(
  username: string,
  domain: string,
  ftpUser: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-delete-web-domain-ftp', [username, domain, ftpUser]);
  return { ok: result.ok, error: result.error };
}

export async function changeFtpPassword(
  username: string,
  domain: string,
  ftpUser: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-change-web-domain-ftp-password', [username, domain, ftpUser, password]);
  return { ok: result.ok, error: result.error };
}

// ---------------------------------------------------------------------------
// Backups — v-backup-user cria um backup completo da conta (web, mail, BD,
// cron, userdir) e coloca-o em /backup. v-list-user-backups devolve a lista
// de backups existentes para uma conta.
// ---------------------------------------------------------------------------

export type HestiaBackup = {
  filename: string;
  type: string;
  size: number; // MB
  web: string[];
  mail: string[];
  db: string[];
  date: string;
  time: string;
  runtime: number; // segundos
};

export async function listBackups(username: string): Promise<HestiaBackup[]> {
  const result = await hestiaCallJson<Record<string, Record<string, string>>>('v-list-user-backups', [username]);
  if (!result.ok) return [];
  return Object.entries(result.data).map(([filename, b]) => ({
    filename,
    type: b.TYPE || 'local',
    size: parseHestiaUsage(b.SIZE),
    web: (b.WEB || '').split(',').map((s) => s.trim()).filter(Boolean),
    mail: (b.MAIL || '').split(',').map((s) => s.trim()).filter(Boolean),
    db: (b.DB || '').split(',').map((s) => s.trim()).filter(Boolean),
    date: b.DATE || '',
    time: b.TIME || '',
    runtime: Number(b.RUNTIME) || 0,
  }));
}

/** Cria um backup da conta. Pode demorar vários segundos para contas com muitos dados. */
export async function createBackup(username: string): Promise<{ ok: boolean; error?: string }> {
  const result = await hestiaCall('v-backup-user', [username]);
  return { ok: result.ok, error: result.error };
}

/** Lê os bytes (base64) de um backup já criado, para o enviar ao bucket de
 * armazenamento — mesma ideia de daBackupReadFile, mas o Hestia guarda tudo
 * em /backup (um único backup por conta inteira, não por domínio). */
export async function readBackupFile(filename: string): Promise<{ ok: boolean; base64?: string; error?: string }> {
  if (!/^[\w.-]+$/.test(filename)) {
    return { ok: false, error: 'Nome de ficheiro inválido' };
  }
  try {
    const quoted = `'/backup/${filename.replace(/'/g, `'\\''`)}'`;
    const out = (await executeServerCommand(`base64 -w0 ${quoted} 2>/dev/null`)).trim();
    if (!out || out.toLowerCase().includes('error')) {
      return { ok: false, error: 'Não foi possível ler o backup' };
    }
    return { ok: true, base64: out };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Download falhou' };
  }
}

// ---------------------------------------------------------------------------
// Gestão de utilizadores (contas de cliente) — criação, alteração de package,
// mudança de password, suspend/unsuspend, delete.
// ---------------------------------------------------------------------------

/** Cria só o utilizador (sem domínio associado). Para criar com domínio usar
 * createAccount() que chama v-add-user + v-add-web-domain em sequência. */
export async function createUserOnly(input: {
  username: string;
  password: string;
  email: string;
  packageName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!emailDeContaValido(input.email)) return { ok: false, error: SEM_EMAIL };
  const result = await hestiaCall('v-add-user', [
    input.username,
    input.password,
    input.email,
    await nomeDoPacoteNoServidor(input.packageName || 'default'),
  ]);
  if (!result.ok && !isAlreadyExistsError(result.error)) {
    return { ok: false, error: result.error };
  }
  return { ok: true };
}

/** Altera o PHP-FPM do site. Hestia: `v-change-web-domain-backend USER DOMAIN VERSION yes`. */
export async function changeWebDomainPhp(
  username: string,
  domain: string,
  phpVersion: string,
): Promise<{ ok: boolean; error?: string }> {
  const version = phpVersion.replace(/[^0-9.]/g, '') || '8.2';
  const result = await hestiaCall('v-change-web-domain-backend', [username, domain, version, 'yes']);
  return { ok: result.ok, error: result.error };
}

/**
 * Cria ou regrava um pacote de cliente no Hestia (Admin › Pacotes › Novo/Editar — Silva, 16/10/2026: "criar pacotes diz
 * que ainda não está ligado ao servidor"). Parte do ficheiro do próprio pacote (ao editar) ou do `default.pkg` (ao
 * criar) e muda só os campos dados; o Hestia lê o ficheiro com `v-add-user-package FICHEIRO NOME yes` (é um FICHEIRO,
 * não uma pasta — com uma pasta dava "… does not exist"). Mudar o nome usa `v-rename-user-package` (do próprio Hestia).
 * `exatos`: campos que o formulário mandou com o valor exato (os outros, só sim/não, não mudam um valor que já cumpre).
 */
export async function gravarPacote(
  nome: string,
  campos: Record<string, string>,
  editar: boolean,
  de?: string,
  exatos: string[] = [],
): Promise<{ ok: boolean; error?: string }> {
  const valido = (n: string) => /^[A-Za-z0-9_-]{1,40}$/.test(n) && n !== 'system';
  if (!valido(nome)) return { ok: false, error: 'Nome de pacote inválido (letras, números, - e _).' };
  const renomear = de !== undefined && de !== nome;
  if (renomear && (!editar || !valido(de as string) || de === 'default')) return { ok: false, error: 'Não é possível mudar o nome deste pacote.' };
  const pastaPacotes = '/usr/local/hestia/data/packages';
  // No servidor os comandos correm localmente e, quando um termina com erro, a resposta traz o texto do próprio comando:
  // por isso a pergunta acaba sempre com `echo` (código 0) e a resposta é só SIM ou NAO.
  const existe = async (n: string) => (await executeServerCommand(`[ -f ${pastaPacotes}/${n}.pkg ] && echo SIM || echo NAO`).catch(() => '')).match(/^SIM\s*$/m) !== null;
  // criar ou mudar o nome: o nome novo não pode já existir (o Hestia regravava por cima do pacote que lá estava)
  if ((!editar || renomear) && (await existe(nome))) return { ok: false, error: 'Já existe um pacote com esse nome no servidor.' };
  if (renomear) {
    if (!(await existe(de as string))) return { ok: false, error: 'Esse pacote não existe no servidor.' };
    const rn = await hestiaCall('v-rename-user-package', [de as string, nome, 'yes']);
    if (!rn.ok) return { ok: false, error: rn.error || 'O servidor recusou mudar o nome do pacote.' };
  }
  const atual = await executeServerCommand(`cat ${pastaPacotes}/${editar ? nome : 'default'}.pkg 2>/dev/null || true`).catch(() => '');
  if (editar && !atual.trim()) return { ok: false, error: 'Esse pacote não existe no servidor.' };
  const texto = juntarCamposPacote(atual, campos, editar, exatos);
  const ficheiro = `/tmp/vh-pacote-${Date.now()}-${nome}.pkg`;
  const b64 = Buffer.from(texto, 'utf8').toString('base64');
  try {
    // o `yes` final do Hestia é "regravar": exige que o pacote JÁ exista (senão "package X doesn't exist") — por isso só se manda ao
    // editar; um pacote novo vai sem ele (era isto que impedia de criar pacotes novos no painel; Silva, 22/10/2026).
    // o Hestia escreve os erros na saída normal e o fim nem sempre vem com código ≠ 0: só "VHRES:0" confirma. O comando
    // acaba sempre com `echo` (código 0) e a marca leva o código do Hestia: com um comando que falha, a resposta do
    // servidor traz o texto do próprio comando e uma marca escrita nele passava por sucesso.
    const saida = await executeServerCommand(
      `echo ${b64} | base64 -d > ${ficheiro} && /usr/local/hestia/bin/v-add-user-package ${ficheiro} ${nome}${editar ? ' yes' : ''} 2>&1; r=$?; rm -f ${ficheiro}; echo "VHRES:$r"`,
    );
    if (/^VHRES:0\s*$/m.test(saida)) return { ok: true };
    return { ok: false, error: saida.replace(/^VHRES:\d+\s*$/m, '').trim() || 'O servidor recusou o pacote.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'O servidor recusou o pacote.' };
  }
}

export async function apagarPacote(nome: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(nome) || nome === 'system' || nome === 'default') return { ok: false, error: 'Este pacote não pode ser apagado.' };
  const result = await hestiaCall('v-delete-user-package', [nome]);
  return { ok: result.ok, error: result.error };
}
