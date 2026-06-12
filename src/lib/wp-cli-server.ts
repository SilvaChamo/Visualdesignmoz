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
