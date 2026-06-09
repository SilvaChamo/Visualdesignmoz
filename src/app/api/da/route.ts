import { NextRequest, NextResponse } from 'next/server';
import { getDirectAdminAPIForAuth } from '@/lib/directadmin-adapter';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';

/**
 * BFF DirectAdmin — o painel revendedor e admin chamam esta rota.
 * Revendedores usam credenciais DIRECTADMIN_RESELLER_* (Osher Collective).
 */

async function resolveApi() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return { error: auth.error } as const;
  const daApi = await getDirectAdminAPIForAuth(auth.user);
  return { daApi, role: auth.user.role } as const;
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveApi();
    if ('error' in resolved) return resolved.error;

    const { daApi } = resolved;
    const body = await req.json();
    const { action, params = {}, timeoutMs } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'action é obrigatória' }, { status: 400 });
    }

    let data: unknown;

    switch (action) {
      case 'listWebsites':
        data = await daApi.listWebsites(timeoutMs);
        break;
      case 'createWebsite':
        data = await daApi.createWebsite(params);
        break;
      case 'suspendWebsite':
        data = await daApi.suspendWebsite(params.domain);
        break;
      case 'unsuspendWebsite':
        data = await daApi.unsuspendWebsite(params.domain);
        break;
      case 'deleteWebsite':
        data = await daApi.deleteWebsite(params.domain);
        break;
      case 'modifyWebsite':
        data = await daApi.modifyWebsite(params);
        break;

      case 'listSubdomains':
        data = await daApi.listSubdomains(params.domain);
        break;
      case 'createSubdomain':
        data = await daApi.createSubdomain(params.domain, params.subdomain);
        break;
      case 'deleteSubdomain':
        data = await daApi.deleteSubdomain(params.domain, params.subdomain);
        break;

      case 'listPackages':
        data = await daApi.listPackages();
        break;

      case 'listUsers':
        data = await daApi.listUsers();
        break;
      case 'createUser':
        data = await daApi.createUser(params);
        break;
      case 'modifyUser':
        data = await daApi.modifyUser(params);
        break;
      case 'deleteUser':
        data = await daApi.deleteUser(params);
        break;

      case 'listEmails':
        data = await daApi.listEmails(params.domain);
        break;
      case 'createEmail':
        data = await daApi.createEmail(params);
        break;
      case 'deleteEmail':
        data = await daApi.deleteEmail(params);
        break;
      case 'suspendEmail':
        data = await daApi.suspendEmail(params.email);
        break;
      case 'unsuspendEmail':
        data = await daApi.unsuspendEmail(params.email);
        break;
      case 'changeEmailPassword':
        data = await daApi.changeEmailPassword(params);
        break;
      case 'setEmailLimits':
        data = await daApi.setEmailLimits(params);
        break;
      case 'getEmailForwarding':
        data = await daApi.getEmailForwarding(params);
        break;
      case 'addEmailForwarding':
        data = await daApi.addEmailForwarding(params);
        break;
      case 'getCatchAllEmail':
        data = await daApi.getCatchAllEmail(params.domain);
        break;
      case 'setCatchAllEmail':
        data = await daApi.setCatchAllEmail(params);
        break;
      case 'getPatternForwarding':
        data = await daApi.getPatternForwarding(params.domain);
        break;
      case 'addPatternForwarding':
        data = await daApi.addPatternForwarding(params);
        break;
      case 'getPlusAddressing':
        data = await daApi.getPlusAddressing(params.domain);
        break;
      case 'togglePlusAddressing':
        data = await daApi.togglePlusAddressing(params);
        break;

      case 'listDatabases':
        data = await daApi.listDatabases(params.domain);
        break;
      case 'createDatabase':
        data = await daApi.createDatabase(params);
        break;
      case 'deleteDatabase':
        data = await daApi.deleteDatabase(params);
        break;

      case 'listFTPAccounts':
        data = await daApi.listFTPAccounts(params.domain);
        break;
      case 'createFTPAccount':
        data = await daApi.createFTPAccount(params);
        break;
      case 'deleteFTPAccount':
        data = await daApi.deleteFTPAccount(params);
        break;

      case 'issueSSL':
        data = await daApi.issueSSL(params.domain);
        break;

      case 'listDNS':
        data = await daApi.listDNS(params.domain);
        break;
      case 'createDNSZone':
        data = await daApi.createDNSZone(params);
        break;
      case 'deleteDNSZone':
        data = await daApi.deleteDNSZone(params);
        break;
      case 'resetDNSConfigurations':
        data = await daApi.resetDNSConfigurations(params.domain);
        break;
      case 'configDefaultNameservers':
        data = await daApi.configDefaultNameservers(params);
        break;
      case 'createNameserver':
        data = await daApi.createNameserver(params);
        break;
      case 'configCloudFlare':
        data = await daApi.configCloudFlare(params);
        break;
      case 'enableDKIM':
        data = await daApi.enableDKIM(params.domain);
        break;
      case 'getDKIMStatus':
        data = await daApi.getDKIMStatus(params.domain);
        break;

      case 'getFirewallStatus':
        data = await daApi.getFirewallStatus();
        break;
      case 'toggleFirewall':
        data = await daApi.toggleFirewall(params);
        break;
      case 'getModSecurityStatus':
        data = await daApi.getModSecurityStatus();
        break;
      case 'toggleModSecurity':
        data = await daApi.toggleModSecurity(params);
        break;
      case 'getBlockedIPs':
        data = await daApi.getBlockedIPs();
        break;
      case 'blockIP':
        data = await daApi.blockIP(params);
        break;
      case 'unblockIP':
        data = await daApi.unblockIP(params);
        break;

      case 'serverStats':
        data = await daApi.getServerStats();
        break;
      case 'generateAPIToken':
        data = await daApi.generateAPIToken();
        break;

      case 'getPHPConfig':
        data = await daApi.getPHPConfig(params.domain);
        break;
      case 'savePHPConfig':
        data = await daApi.savePHPConfig(params);
        break;
      case 'changePHPVersion':
        data = await daApi.changePHPVersion(params);
        break;

      case 'listACLs':
        data = await daApi.listACLs();
        break;
      case 'createACL':
        data = await daApi.createACL(params);
        break;
      case 'deleteACL':
        data = await daApi.deleteACL(params);
        break;

      case 'listWordPress':
        data = await daApi.listWordPress(params.domain);
        break;
      case 'installWordPress':
        data = await daApi.installWordPress(params);
        break;
      case 'listWPPlugins':
        data = await daApi.listWPPlugins(params);
        break;
      case 'installWPPlugin':
        data = await daApi.installWPPlugin(params);
        break;
      case 'toggleWPPlugin':
        data = await daApi.toggleWPPlugin(params);
        break;
      case 'listWPBackups':
        data = await daApi.listWPBackups(params.domain);
        break;
      case 'restoreWPBackup':
        data = await daApi.restoreWPBackup(params);
        break;
      case 'createRemoteBackup':
        data = await daApi.createRemoteBackup(params);
        break;

      case 'execCommand':
        data = await daApi.execCommand(params.command);
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Ação "${action}" não suportada.`, supported: false },
          { status: 400 },
        );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[DA API ERROR]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveApi();
    if ('error' in resolved) return resolved.error;

    const { daApi } = resolved;
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (!action) {
      return NextResponse.json({ success: false, error: 'action é obrigatória' }, { status: 400 });
    }

    let data: unknown;
    switch (action) {
      case 'listUsers':
        data = await daApi.listUsers();
        break;
      case 'listPackages':
        data = await daApi.listPackages();
        break;
      case 'listWebsites':
        data = await daApi.listWebsites();
        break;
      default:
        return NextResponse.json(
          { success: false, error: `GET action "${action}" não suportada` },
          { status: 400 },
        );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
