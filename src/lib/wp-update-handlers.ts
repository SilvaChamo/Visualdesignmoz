import {
  listWpInstalls,
  listWpPlugins,
  resolveWpInstall,
  updateAllWpPlugins,
  updateWpPlugin,
} from '@/lib/wp-cli-server';

export async function handleWpUpdateGet(domain: string) {
  if (!domain) {
    const installs = await listWpInstalls();
    return { success: true as const, installs };
  }

  const install = await resolveWpInstall(domain);
  if (!install) {
    return {
      success: false as const,
      error: 'WordPress não encontrado neste domínio',
      status: 404,
    };
  }

  const plugins = await listWpPlugins(domain);
  return { success: true as const, install, plugins };
}

export async function handleWpUpdatePost(
  domain: string,
  body: { plugin?: string; all?: boolean },
) {
  if (body.all) {
    const result = await updateAllWpPlugins(domain);
    const plugins = result.ok ? await listWpPlugins(domain) : undefined;
    return { success: result.ok, output: result.output, plugins };
  }

  const plugin = String(body.plugin || '').trim();
  if (!plugin) {
    return {
      success: false as const,
      error: 'plugin é obrigatório',
      status: 400,
    };
  }

  const result = await updateWpPlugin(domain, plugin);
  const plugins = result.ok ? await listWpPlugins(domain) : undefined;
  return { success: result.ok, output: result.output, plugins };
}
