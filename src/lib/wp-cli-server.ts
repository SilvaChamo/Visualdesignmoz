/**
 * WordPress via wp-cli no servidor (SSH) — funciona tanto no Hetzner
 * (DirectAdmin, pastas em .../domains/<dominio>/public_html) como no Contabo
 * (HestiaCP, pastas em .../web/<dominio>/public_html); o utilizador dono do
 * site fica sempre no 3º segmento do caminho a partir de /home em ambos os
 * casos.
 */

import crypto from 'crypto';
import { executeServerCommand } from '@/lib/server-ssh-exec';

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Raízes onde um site pode viver, consoante o painel de hospedagem por trás do servidor. */
const SITE_ROOT_DIRS = ['domains', 'web'] as const;

function siteRootGlobs(safeDomain: string): string {
  return SITE_ROOT_DIRS.map((dir) => `/home/*/${dir}/${safeDomain}/public_html`).join(' ');
}

function parseSiteOwner(path: string): string {
  const match = path.match(/^\/home\/([^/]+)\/(?:domains|web)\//);
  return match ? match[1] : '';
}

export interface WpInstallInfo {
  domain: string;
  path: string;
  user: string;
  wpVersion?: string;
}

export interface WpPluginRow {
  name: string;
  title?: string;
  status: string;
  version: string;
  update: string | null;
  update_version?: string;
}

/** `admin`: o wp-cli corre como o admin-ajax (mu-plugin do stack, `VD_CTX_ADMIN=1`): os plugins Jet só se iniciam assim e só assim trazem o pacote de actualização. */
async function runAsWpUser(user: string, wpPath: string, wpArgs: string, admin = false): Promise<string> {
  const env = admin ? 'env VD_CTX_ADMIN=1 ' : '';
  const cmd = `sudo -u ${shellQuote(user)} ${env}/usr/local/bin/wp --path=${shellQuote(wpPath)} ${wpArgs} 2>&1`;
  return (await executeServerCommand(cmd)).trim();
}

export async function resolveDomainSitePath(
  domain: string,
): Promise<{ user: string; path: string } | null> {
  const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '');
  if (!safeDomain) return null;

  const raw = await executeServerCommand(
    `ls -d ${siteRootGlobs(safeDomain)} 2>/dev/null | head -1`,
  );
  const path = raw.trim();
  if (!path) return null;

  const user = parseSiteOwner(path);
  return user ? { user, path } : null;
}

/** Preparação do WordPress no servidor (WP-Optimize e cache de página, Redis com prefixo próprio, mu-plugin, sem Akismet/Hello Dolly).
 *  Vive na pasta da versão em uso, por isso cada deploy a actualiza; é a mesma que o workflow ops-wordpress-cache-aplicar.yml usa nos sites antigos. */
const WP_PREPARAR_SCRIPT = '/opt/visualdesignmoz/deploy/wordpress/wp-cache-on-site.sh';

export async function installWordPressSite(input: {
  domain: string;
  directory?: string;
  siteTitle: string;
  adminUser: string;
  adminPassword: string;
  adminEmail: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  /** prefixo das tabelas (por defeito wp_) */
  dbPrefix?: string;
  protocol?: 'http' | 'https';
}): Promise<{ ok: boolean; output: string }> {
  const site = await resolveDomainSitePath(input.domain);
  if (!site) return { ok: false, output: 'Domínio não encontrado no servidor.' };

  const subdir = (input.directory || '').replace(/^\/+|\/+$/g, '');
  // só uma subpasta do site (letras, números, ponto, hífen e _; sem "..")
  if (subdir && (!/^[A-Za-z0-9._/-]{1,120}$/.test(subdir) || subdir.split('/').some((x) => !x || x === '.' || x === '..'))) {
    return { ok: false, output: 'Pasta inválida.' };
  }
  const wpPath = subdir ? `${site.path}/${subdir}` : site.path;
  const configPath = `${wpPath}/wp-config.php`;

  const exists = (
    await executeServerCommand(`test -f ${shellQuote(configPath)} && echo yes || echo no`)
  ).trim();
  if (exists === 'yes') {
    return { ok: false, output: 'WordPress já está instalado neste caminho.' };
  }

  // criada como o dono do site (nunca root + chown dentro da pasta do cliente)
  await executeServerCommand(`sudo -u ${shellQuote(site.user)} mkdir -p ${shellQuote(wpPath)}`);

  const proto = input.protocol === 'http' ? 'http' : 'https';
  const url = subdir
    ? `${proto}://${input.domain}/${subdir}`
    : `${proto}://${input.domain}`;

  const steps = [
    'core download',
    `config create --dbname=${shellQuote(input.dbName)} --dbuser=${shellQuote(input.dbUser)} --dbpass=${shellQuote(input.dbPassword)} --dbhost=localhost${input.dbPrefix ? ` --dbprefix=${shellQuote(input.dbPrefix)}` : ''} --skip-check`,
    `core install --url=${shellQuote(url)} --title=${shellQuote(input.siteTitle || input.domain)} --admin_user=${shellQuote(input.adminUser)} --admin_password=${shellQuote(input.adminPassword)} --admin_email=${shellQuote(input.adminEmail)} --skip-email`,
  ];

  const outputs: string[] = [];
  for (const step of steps) {
    const out = await runAsWpUser(site.user, wpPath, step);
    outputs.push(out);
    if (wpCommandFailed(out)) {
      return { ok: false, output: out || 'Falha na instalação WordPress.' };
    }
  }

  // Passos pós-instalação que o painel deixa prontos para o cliente, para não
  // ser preciso mexer no wp-cli à mão depois:
  //  - ligações permanentes "bonitas" (/nome-do-artigo/). Usa-se
  //    `option update permalink_structure` + `rewrite flush` de propósito:
  //    `wp rewrite structure` rebenta com erro de subprocesso nalgumas versões.
  //  - cache e plugins por defeito: corre o script do servidor (WP-Optimize activo com a cache de página ligada, Redis com prefixo
  //    próprio do site, mu-plugin do stack, sem Akismet nem Hello Dolly). Está fora do código do painel para ser a mesma preparação em todo o lado.
  // Best-effort: se algum falhar, a instalação continua válida na mesma.
  for (const extra of [
    `option update permalink_structure '/%postname%/'`,
    'rewrite flush --hard',
  ]) {
    outputs.push(await runAsWpUser(site.user, wpPath, extra).catch(() => ''));
  }
  outputs.push(
    await executeServerCommand(
      `test -f ${WP_PREPARAR_SCRIPT} && bash ${WP_PREPARAR_SCRIPT} ${shellQuote(wpPath)} ${shellQuote(site.user)} ${shellQuote(input.domain)} 2>&1; true`,
      { timeoutMs: 240_000 },
    ).catch(() => ''),
  );

  return { ok: true, output: outputs.join('\n') || 'WordPress instalado com sucesso.' };
}

/**
 * Depois de emitir SSL num domínio com WordPress: passa os endereços do site
 * (home/siteurl) para https e regenera as regras de reescrita. Best-effort —
 * nunca lança, para não fazer falhar a emissão de SSL em si.
 */
export async function switchWpToHttps(domain: string): Promise<void> {
  const install = await resolveWpInstall(domain);
  if (!install) return;
  const base = `https://${domain.replace(/[^a-zA-Z0-9.-]/g, '')}`;
  for (const args of [
    `option update home ${shellQuote(base)}`,
    `option update siteurl ${shellQuote(base)}`,
    'rewrite flush --hard',
  ]) {
    await runAsWpUser(install.user, install.path, args).catch(() => undefined);
  }
}

export async function resolveWpInstall(domain: string): Promise<WpInstallInfo | null> {
  const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '');
  if (!safeDomain) return null;

  const globs = SITE_ROOT_DIRS.map((dir) => `/home/*/${dir}/${safeDomain}/public_html/wp-config.php`).join(' ');
  const configPath = (
    await executeServerCommand(`ls -d ${globs} 2>/dev/null | head -1`)
  ).trim();
  if (!configPath) return null;

  const wpPath = configPath.replace(/\/wp-config\.php$/, '');
  const user = parseSiteOwner(wpPath);
  if (!user) return null;

  return { domain: safeDomain, path: wpPath, user };
}

export async function listWpInstalls(): Promise<WpInstallInfo[]> {
  // -maxdepth 5 evita descer para dentro de public_html (uploads, cache, etc.) —
  // wp-config.php está sempre a essa profundidade fixa a partir de /home, tanto
  // em DirectAdmin (/domains/) como em HestiaCP (/web/).
  const findCmd =
    `find /home -maxdepth 5 \\( -path '*/domains/*/public_html/wp-config.php' -o -path '*/web/*/public_html/wp-config.php' \\) ` +
    `2>/dev/null | grep -vi backup | sort`;
  const raw = (await executeServerCommand(findCmd)).trim();
  if (!raw) return [];

  const installs: WpInstallInfo[] = [];
  for (const configPath of raw.split('\n').filter(Boolean)) {
    const match = configPath.match(
      /^\/home\/([^/]+)\/(?:domains|web)\/([^/]+)\/public_html\/wp-config\.php$/,
    );
    if (!match) continue;
    const [, user, domain] = match;
    installs.push({
      domain,
      path: configPath.replace(/\/wp-config\.php$/, ''),
      user,
    });
  }
  return installs;
}

function parseWpJson<T>(raw: string): T {
  const start = raw.indexOf('[');
  const startObj = raw.indexOf('{');
  const idx =
    start >= 0 && (startObj < 0 || start < startObj) ? start : startObj >= 0 ? startObj : -1;
  if (idx < 0) {
    throw new Error(raw.slice(0, 400) || 'Resposta vazia do wp-cli');
  }
  try {
    return JSON.parse(raw.slice(idx)) as T;
  } catch {
    throw new Error(raw.slice(0, 400) || 'JSON inválido do wp-cli');
  }
}

export async function listWpPlugins(domain: string): Promise<WpPluginRow[]> {
  const install = await resolveWpInstall(domain);
  if (!install) {
    throw new Error('WordPress não encontrado neste domínio');
  }

  // Só plugins normais (activos/inactivos) — alinha com o ecrã «Plugins» do WordPress.
  // Must-use e drop-ins são infra da hospedagem, visíveis no WP em separado.
  // A lista guardada pelo mu-plugin (vd_plugin_updates) vem em paralelo: o wp-cli não carrega os actualizadores que os plugins pagos só
  // registam no administrador, por isso sozinho não via as actualizações que o WordPress mostra.
  const [raw, guardadas] = await Promise.all([
    runAsWpUser(install.user, install.path, 'plugin list --format=json --status=active,inactive'),
    runAsWpUser(install.user, install.path, '--skip-plugins --skip-themes option get vd_plugin_updates --format=json').catch(() => ''),
  ]);
  const rows = parseWpJson<WpPluginRow[]>(raw);
  if (!Array.isArray(rows)) {
    throw new Error('Lista de plugins inválida');
  }
  return juntarActualizacoesDoAdmin(rows, guardadas);
}

/** Marca como «available» os plugins que o administrador do WordPress diz ter versão nova e o wp-cli não viu. Só vale se a versão
 *  guardada for diferente da instalada (depois de actualizar, a cópia pode demorar até 10 min a renovar-se). */
export function juntarActualizacoesDoAdmin(rows: WpPluginRow[], guardadasRaw: string): WpPluginRow[] {
  let guardadas: Record<string, string> = {};
  try {
    const ini = guardadasRaw.indexOf('{');
    const obj = ini >= 0 ? (JSON.parse(guardadasRaw.slice(ini)) as { plugins?: Record<string, string> }) : null;
    if (obj && obj.plugins && typeof obj.plugins === 'object') guardadas = obj.plugins;
  } catch {
    return rows;
  }
  const porNome = new Map<string, string>();
  for (const [ficheiro, versao] of Object.entries(guardadas)) {
    const nome = ficheiro.includes('/') ? ficheiro.split('/')[0] : ficheiro.replace(/\.php$/, '');
    if (versao) porNome.set(nome, versao);
  }
  return rows.map((p) => {
    const nova = porNome.get(p.name);
    if (!nova || p.update === 'available' || nova === p.version) return p;
    return { ...p, update: 'available', update_version: nova };
  });
}

export async function updateWpPlugin(
  domain: string,
  plugin: string,
): Promise<{ ok: boolean; output: string }> {
  const install = await resolveWpInstall(domain);
  if (!install) {
    return { ok: false, output: 'WordPress não encontrado neste domínio' };
  }

  const safePlugin = plugin.replace(/[^a-zA-Z0-9_/-]/g, '');
  if (!safePlugin) {
    return { ok: false, output: 'Nome de plugin inválido' };
  }

  const output = await runAsWpUser(
    install.user,
    install.path,
    `plugin update ${shellQuote(safePlugin)}`,
    true,
  );
  const failed =
    /error:|failed|fatal/i.test(output) && !/success|updated/i.test(output);
  return { ok: !failed, output };
}

export async function updateAllWpPlugins(
  domain: string,
): Promise<{ ok: boolean; output: string }> {
  const install = await resolveWpInstall(domain);
  if (!install) {
    return { ok: false, output: 'WordPress não encontrado neste domínio' };
  }

  const output = await runAsWpUser(install.user, install.path, 'plugin update --all', true);
  const failed =
    /error:|failed|fatal/i.test(output) && !/success|updated|already/i.test(output);
  return { ok: !failed, output };
}

function safePluginSlug(plugin: string): string {
  return plugin.replace(/[^a-zA-Z0-9_/-]/g, '');
}

function wpCommandFailed(output: string): boolean {
  return /error:|failed|fatal/i.test(output) && !/success|activated|deactivated|installed|updated|already|removed/i.test(output);
}

export async function toggleWpPlugin(
  domain: string,
  plugin: string,
  activate: boolean,
): Promise<{ ok: boolean; output: string }> {
  const install = await resolveWpInstall(domain);
  if (!install) return { ok: false, output: 'WordPress não encontrado neste domínio' };

  const slug = safePluginSlug(plugin);
  if (!slug) return { ok: false, output: 'Nome de plugin inválido' };

  const verb = activate ? 'activate' : 'deactivate';
  const output = await runAsWpUser(install.user, install.path, `plugin ${verb} ${shellQuote(slug)}`);
  return { ok: !wpCommandFailed(output), output };
}

export async function installWpPluginFromRepo(
  domain: string,
  slug: string,
  activate = true,
): Promise<{ ok: boolean; output: string }> {
  const install = await resolveWpInstall(domain);
  if (!install) return { ok: false, output: 'WordPress não encontrado neste domínio' };

  const safe = safePluginSlug(slug);
  if (!safe) return { ok: false, output: 'Slug inválido' };

  const flags = activate ? ' --activate' : '';
  const output = await runAsWpUser(
    install.user,
    install.path,
    `plugin install ${shellQuote(safe)}${flags}`,
  );
  return { ok: !wpCommandFailed(output), output };
}

export async function deleteWpPlugin(
  domain: string,
  plugin: string,
): Promise<{ ok: boolean; output: string }> {
  const install = await resolveWpInstall(domain);
  if (!install) return { ok: false, output: 'WordPress não encontrado neste domínio' };

  const slug = safePluginSlug(plugin);
  if (!slug) return { ok: false, output: 'Nome de plugin inválido' };

  const output = await runAsWpUser(
    install.user,
    install.path,
    `plugin delete ${shellQuote(slug)}`,
  );
  return { ok: !wpCommandFailed(output), output };
}

/** Envia ZIP para o servidor e instala com wp-cli. */
export async function uploadWpPluginZip(
  domain: string,
  zipBase64: string,
  filename: string,
): Promise<{ ok: boolean; output: string }> {
  const install = await resolveWpInstall(domain);
  if (!install) return { ok: false, output: 'WordPress não encontrado neste domínio' };

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '') || 'plugin.zip';
  if (!safeName.toLowerCase().endsWith('.zip')) {
    return { ok: false, output: 'O ficheiro deve ser .zip' };
  }

  const tmpB64 = `/tmp/wp-plg-${Date.now()}.b64`;
  const tmpZip = `/tmp/wp-plg-${Date.now()}-${safeName}`;
  const chunkSize = 48000;
  const clean = zipBase64.replace(/\s/g, '');

  for (let i = 0; i < clean.length; i += chunkSize) {
    const chunk = clean.slice(i, i + chunkSize);
    const op = i === 0 ? `>` : `>>`;
    await executeServerCommand(`printf '%s' '${chunk}' ${op} ${shellQuote(tmpB64)}`);
  }

  await executeServerCommand(
    `base64 -d ${shellQuote(tmpB64)} > ${shellQuote(tmpZip)} && rm -f ${shellQuote(tmpB64)}`,
  );

  try {
    const output = await runAsWpUser(
      install.user,
      install.path,
      `plugin install ${shellQuote(tmpZip)} --activate`,
    );
    return { ok: !wpCommandFailed(output), output };
  } finally {
    await executeServerCommand(`rm -f ${shellQuote(tmpZip)}`).catch(() => undefined);
  }
}

export interface WpUserRow {
  ID: string;
  user_login: string;
  user_email: string;
  roles: string;
  user_registered: string;
  user_url?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  telefone?: string;
  profissao?: string;
  cargo?: string;
  description?: string;
}

export async function listWpUsers(domain: string): Promise<WpUserRow[]> {
  const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '');
  if (!safeDomain) {
    throw new Error('Domínio inválido');
  }

  const script = `
    CONFIG=$(ls -d /home/*/domains/${safeDomain}/public_html/wp-config.php /home/*/web/${safeDomain}/public_html/wp-config.php 2>/dev/null | head -1)
    if [ -z "$CONFIG" ]; then
      echo '{"error": "WordPress não encontrado"}'
      exit 0
    fi
    WPPATH=$(dirname "$CONFIG")
    USER=$(echo "$WPPATH" | awk -F'/' '{print $3}')
    # List basic fields
    USERS_JSON=$(sudo -u "$USER" /usr/local/bin/wp --path="$WPPATH" user list --fields=ID,user_login,user_email,roles,user_registered,user_url,display_name,first_name,last_name --format=json 2>&1)
    
    # We will need to inject meta fields but let's just return what we have and maybe fetch meta later if needed or in a loop.
    # To keep list fast, we just return basic WP fields plus first_name, last_name, display_name, user_url.
    # The meta fields like telefone, profissao, cargo can be fetched per user during edit.
    echo "$USERS_JSON"
  `;

  const raw = await executeServerCommand(script);
  if (raw.includes('{"error": "WordPress não encontrado"}')) {
    throw new Error('WordPress não encontrado neste domínio');
  }

  return parseWpJson<WpUserRow[]>(raw);
}

export async function createWpUser(input: {
  domain: string;
  username: string;
  email: string;
  role: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  website?: string;
  displayName?: string;
  bio?: string;
  telefone?: string;
  profissao?: string;
  cargo?: string;
}): Promise<{ ok: boolean; output: string }> {
  const install = await resolveWpInstall(input.domain);
  if (!install) return { ok: false, output: 'WordPress não encontrado neste domínio' };

  const role = input.role || 'administrator';
  const passArg = input.password ? ` --user_pass=${shellQuote(input.password)}` : '';
  const firstArg = input.firstName ? ` --first_name=${shellQuote(input.firstName)}` : '';
  const lastArg = input.lastName ? ` --last_name=${shellQuote(input.lastName)}` : '';
  const urlArg = input.website ? ` --user_url=${shellQuote(input.website)}` : '';
  const displayArg = input.displayName ? ` --display_name=${shellQuote(input.displayName)}` : '';
  
  const args = `user create ${shellQuote(input.username)} ${shellQuote(input.email)} --role=${shellQuote(role)}${passArg}${firstArg}${lastArg}${urlArg}${displayArg} --porcelain`;
  
  let script = `
    NEW_ID=$(sudo -u ${shellQuote(install.user)} /usr/local/bin/wp --path=${shellQuote(install.path)} ${args})
    echo "$NEW_ID"
    if [[ "$NEW_ID" =~ ^[0-9]+$ ]]; then
  `;
  if (input.bio) script += `      sudo -u ${shellQuote(install.user)} /usr/local/bin/wp --path=${shellQuote(install.path)} user meta update "$NEW_ID" description ${shellQuote(input.bio)} >/dev/null 2>&1\n`;
  if (input.telefone) script += `      sudo -u ${shellQuote(install.user)} /usr/local/bin/wp --path=${shellQuote(install.path)} user meta update "$NEW_ID" telefone ${shellQuote(input.telefone)} >/dev/null 2>&1\n`;
  if (input.profissao) script += `      sudo -u ${shellQuote(install.user)} /usr/local/bin/wp --path=${shellQuote(install.path)} user meta update "$NEW_ID" profissao ${shellQuote(input.profissao)} >/dev/null 2>&1\n`;
  if (input.cargo) script += `      sudo -u ${shellQuote(install.user)} /usr/local/bin/wp --path=${shellQuote(install.path)} user meta update "$NEW_ID" cargo ${shellQuote(input.cargo)} >/dev/null 2>&1\n`;
  script += `    fi`;

  const output = await executeServerCommand(script);
  if (wpCommandFailed(output)) {
    return { ok: false, output };
  }

  return { ok: true, output };
}

export async function deleteWpUser(
  domain: string,
  username: string,
): Promise<{ ok: boolean; output: string }> {
  const install = await resolveWpInstall(domain);
  if (!install) return { ok: false, output: 'WordPress não encontrado neste domínio' };

  const output = await runAsWpUser(
    install.user,
    install.path,
    `user delete ${shellQuote(username)} --yes`,
  );
  return { ok: !wpCommandFailed(output), output };
}

export async function generateWpAutoLoginToken(
  domain: string,
  username?: string,
  postId?: number,
  editor: 'wordpress' | 'elementor' = 'wordpress',
): Promise<{ success: boolean; url?: string; error?: string }> {
  const install = await resolveWpInstall(domain);
  if (!install) return { success: false, error: 'WordPress não encontrado neste domínio' };
  if (postId !== undefined && (!Number.isSafeInteger(postId) || postId <= 0)) {
    return { success: false, error: 'Página inválida.' };
  }
  if (editor === 'elementor' && postId === undefined) {
    return { success: false, error: 'Escolha uma página Elementor.' };
  }

  // Sem utilizador indicado (botão "Painel do WordPress"): entra como o
  // primeiro administrador do site.
  let login = (username || '').trim();
  if (!login) {
    const raw = await runAsWpUser(
      install.user,
      install.path,
      // sem plugins nem tema: só é preciso a tabela de utilizadores, e arrancar o WordPress inteiro custava 1 a 2 s a mais
      '--skip-plugins --skip-themes user list --role=administrator --field=user_login --format=csv',
    ).catch(() => '');
    login = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^user_login$/i.test(l))[0] || '';
    if (!login) {
      return { success: false, error: 'Nenhum administrador encontrado neste WordPress.' };
    }
  }

  const token = crypto.randomUUID();
  const filename = `wp-login-${token}.php`;
  const filePath = `${install.path}/${filename}`;
  // o Elementor abre pelo mesmo endereço do editor do WordPress, com action=elementor
  const acao = editor === 'elementor' ? 'elementor' : 'edit';
  // sem página indicada entra na lista de Páginas e não no Painel (wp-admin/): o Painel carrega os widgets e as notícias do WordPress
  // (e do Elementor) e demorava mais do dobro a abrir (7,8 s contra 3,3 s medidos no servidor; Silva, 22/10/2026)
  const destino = postId === undefined ? "admin_url('edit.php?post_type=page')" : `admin_url('post.php?post=${postId}&action=${acao}')`;

  const phpContent = `<?php
// Autologin gerado pelo painel
@unlink(__FILE__);
require_once __DIR__ . '/wp-load.php';
$user = get_user_by('login', '${login.replace(/'/g, "\\'")}');
if ($user) {
    wp_clear_auth_cookie();
    wp_set_current_user($user->ID);
    wp_set_auth_cookie($user->ID, true);
    wp_safe_redirect(${destino});
    exit;
} else {
    echo "Erro: Utilizador não encontrado.";
}
`;

  const base64Content = Buffer.from(phpContent).toString('base64');
  // escrito como o dono do site (nunca root + chown: a pasta é do cliente e uma ligação simbólica posta lá
  // faria o root mudar o dono de um ficheiro do sistema)
  const writeCmd = `echo '${base64Content}' | base64 -d | sudo -u ${shellQuote(install.user)} sh -c 'cat > "$1"' _ ${shellQuote(filePath)}`;

  try {
    await executeServerCommand(writeCmd);
    const url = `https://${domain}/${filename}`;
    return { success: true, url };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao criar ficheiro de auto-login';
    return { success: false, error: msg };
  }
}

export async function updateWpUserPassword(
  domain: string,
  username: string,
  newPassword: string,
): Promise<{ ok: boolean; output: string }> {
  const install = await resolveWpInstall(domain);
  if (!install) return { ok: false, output: 'WordPress não encontrado neste domínio' };

  const output = await runAsWpUser(
    install.user,
    install.path,
    `user update ${shellQuote(username)} --user_pass=${shellQuote(newPassword)}`,
  );
  return { ok: !wpCommandFailed(output), output };
}

export async function updateWpUser(input: {
  domain: string;
  username: string;
  email: string;
  role: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  website?: string;
  displayName?: string;
  bio?: string;
  telefone?: string;
  profissao?: string;
  cargo?: string;
}): Promise<{ ok: boolean; output: string }> {
  const install = await resolveWpInstall(input.domain);
  if (!install) return { ok: false, output: 'WordPress não encontrado neste domínio' };

  const passArg = input.password ? ` --user_pass=${shellQuote(input.password)}` : '';
  const roleArg = input.role ? ` --role=${shellQuote(input.role)}` : '';
  const emailArg = input.email ? ` --user_email=${shellQuote(input.email)}` : '';
  const firstArg = input.firstName ? ` --first_name=${shellQuote(input.firstName)}` : '';
  const lastArg = input.lastName ? ` --last_name=${shellQuote(input.lastName)}` : '';
  const urlArg = input.website ? ` --user_url=${shellQuote(input.website)}` : '';
  const displayArg = input.displayName ? ` --display_name=${shellQuote(input.displayName)}` : '';
  
  const args = `user update ${shellQuote(input.username)}${roleArg}${passArg}${emailArg}${firstArg}${lastArg}${urlArg}${displayArg}`;

  let script = `
    sudo -u ${shellQuote(install.user)} /usr/local/bin/wp --path=${shellQuote(install.path)} ${args}
  `;
  if (input.bio !== undefined) script += `    sudo -u ${shellQuote(install.user)} /usr/local/bin/wp --path=${shellQuote(install.path)} user meta update ${shellQuote(input.username)} description ${shellQuote(input.bio)} >/dev/null 2>&1\n`;
  if (input.telefone !== undefined) script += `    sudo -u ${shellQuote(install.user)} /usr/local/bin/wp --path=${shellQuote(install.path)} user meta update ${shellQuote(input.username)} telefone ${shellQuote(input.telefone)} >/dev/null 2>&1\n`;
  if (input.profissao !== undefined) script += `    sudo -u ${shellQuote(install.user)} /usr/local/bin/wp --path=${shellQuote(install.path)} user meta update ${shellQuote(input.username)} profissao ${shellQuote(input.profissao)} >/dev/null 2>&1\n`;
  if (input.cargo !== undefined) script += `    sudo -u ${shellQuote(install.user)} /usr/local/bin/wp --path=${shellQuote(install.path)} user meta update ${shellQuote(input.username)} cargo ${shellQuote(input.cargo)} >/dev/null 2>&1\n`;

  const output = await executeServerCommand(script);
  if (wpCommandFailed(output)) {
    return { ok: false, output };
  }

  return { ok: true, output };
}

export async function getWpUser(domain: string, username: string): Promise<WpUserRow | null> {
  const install = await resolveWpInstall(domain);
  if (!install) return null;

  const script = `
    USER_JSON=$(sudo -u ${shellQuote(install.user)} /usr/local/bin/wp --path=${shellQuote(install.path)} user get ${shellQuote(username)} --fields=ID,user_login,user_email,roles,user_registered,user_url,display_name,first_name,last_name --format=json 2>/dev/null)
    if [ -z "$USER_JSON" ]; then
      echo ""
      exit 0
    fi
    META_JSON=$(sudo -u ${shellQuote(install.user)} /usr/local/bin/wp --path=${shellQuote(install.path)} user meta list ${shellQuote(username)} --format=json 2>/dev/null)
    echo "---SPLIT---"
    echo "$USER_JSON"
    echo "---SPLIT---"
    echo "$META_JSON"
  `;
  
  const raw = await executeServerCommand(script);
  const parts = raw.split('---SPLIT---');
  if (parts.length < 3) return null;

  try {
    const userJson = parts[1].trim();
    const metaJson = parts[2].trim();
    const user = JSON.parse(userJson) as WpUserRow;
    
    if (metaJson) {
      const metas = JSON.parse(metaJson) as Array<{meta_key: string, meta_value: string}>;
      for (const meta of metas) {
        if (meta.meta_key === 'description') user.description = meta.meta_value;
        if (meta.meta_key === 'telefone') user.telefone = meta.meta_value;
        if (meta.meta_key === 'profissao') user.profissao = meta.meta_value;
        if (meta.meta_key === 'cargo') user.cargo = meta.meta_value;
      }
    }
    
    return user;
  } catch (e) {
    return null;
  }
}
