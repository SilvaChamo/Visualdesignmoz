/**
 * WordPress via wp-cli no servidor Hetzner (SSH).
 */

import { executeServerCommand } from '@/lib/server-ssh-exec';

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
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

async function runAsWpUser(user: string, wpPath: string, wpArgs: string): Promise<string> {
  const cmd = `sudo -u ${shellQuote(user)} /usr/local/bin/wp --path=${shellQuote(wpPath)} ${wpArgs} 2>&1`;
  return (await executeServerCommand(cmd)).trim();
}

export async function resolveWpInstall(domain: string): Promise<WpInstallInfo | null> {
  const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '');
  if (!safeDomain) return null;

  const findCmd = `find /home -path "*/domains/${safeDomain}/public_html/wp-config.php" 2>/dev/null | head -1`;
  const configPath = (await executeServerCommand(findCmd)).trim();
  if (!configPath) return null;

  const wpPath = configPath.replace(/\/wp-config\.php$/, '');
  const user = (await executeServerCommand(`stat -c '%U' ${shellQuote(wpPath)}`)).trim();
  if (!user) return null;

  let wpVersion: string | undefined;
  try {
    wpVersion = (await runAsWpUser(user, wpPath, 'core version')).trim() || undefined;
  } catch {
    wpVersion = undefined;
  }

  return { domain: safeDomain, path: wpPath, user, wpVersion };
}

export async function listWpInstalls(): Promise<WpInstallInfo[]> {
  const findCmd = `find /home -path '*/domains/*/public_html/wp-config.php' 2>/dev/null | grep -vi backup | sort`;
  const raw = (await executeServerCommand(findCmd)).trim();
  if (!raw) return [];

  const installs: WpInstallInfo[] = [];
  for (const configPath of raw.split('\n').filter(Boolean)) {
    const match = configPath.match(/\/domains\/([^/]+)\/public_html\/wp-config\.php$/);
    if (!match) continue;
    const domain = match[1];
    const info = await resolveWpInstall(domain);
    if (info) installs.push(info);
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

  const raw = await runAsWpUser(install.user, install.path, 'plugin list --format=json');
  const rows = parseWpJson<WpPluginRow[]>(raw);
  if (!Array.isArray(rows)) {
    throw new Error('Lista de plugins inválida');
  }
  return rows;
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

  const output = await runAsWpUser(install.user, install.path, 'plugin update --all');
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
