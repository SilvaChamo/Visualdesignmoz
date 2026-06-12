import {
  deleteWpPlugin,
  installWpPluginFromRepo,
  listWpInstalls,
  listWpPlugins,
  resolveWpInstall,
  toggleWpPlugin,
  updateAllWpPlugins,
  updateWpPlugin,
  uploadWpPluginZip,
} from '@/lib/wp-cli-server';

export type WpPluginAction =
  | 'update'
  | 'updateAll'
  | 'activate'
  | 'deactivate'
  | 'install'
  | 'delete'
  | 'upload';

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
  body: {
    plugin?: string;
    all?: boolean;
    action?: WpPluginAction;
    slug?: string;
    activate?: boolean;
    zipBase64?: string;
    filename?: string;
  },
) {
  const plugin = String(body.plugin || body.slug || '').trim();

  if (body.all || body.action === 'updateAll') {
    const result = await updateAllWpPlugins(domain);
    const plugins = result.ok ? await listWpPlugins(domain) : undefined;
    return { success: result.ok, output: result.output, plugins };
  }

  if (body.action === 'upload') {
    const zipBase64 = String(body.zipBase64 || '').trim();
    const filename = String(body.filename || 'plugin.zip').trim();
    if (!zipBase64) {
      return { success: false as const, error: 'zipBase64 é obrigatório', status: 400 };
    }
    const result = await uploadWpPluginZip(domain, zipBase64, filename);
    const plugins = result.ok ? await listWpPlugins(domain) : undefined;
    return { success: result.ok, output: result.output, plugins };
  }

  if (body.action === 'install') {
    if (!plugin) {
      return { success: false as const, error: 'slug do plugin é obrigatório', status: 400 };
    }
    const result = await installWpPluginFromRepo(domain, plugin, body.activate !== false);
    const plugins = result.ok ? await listWpPlugins(domain) : undefined;
    return { success: result.ok, output: result.output, plugins };
  }

  if (body.action === 'activate' || body.action === 'deactivate') {
    if (!plugin) {
      return { success: false as const, error: 'plugin é obrigatório', status: 400 };
    }
    const result = await toggleWpPlugin(domain, plugin, body.action === 'activate');
    const plugins = result.ok ? await listWpPlugins(domain) : undefined;
    return { success: result.ok, output: result.output, plugins };
  }

  if (body.action === 'delete') {
    if (!plugin) {
      return { success: false as const, error: 'plugin é obrigatório', status: 400 };
    }
    const result = await deleteWpPlugin(domain, plugin);
    const plugins = result.ok ? await listWpPlugins(domain) : undefined;
    return { success: result.ok, output: result.output, plugins };
  }

  // Actualizar um plugin (legado: só plugin sem action)
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
