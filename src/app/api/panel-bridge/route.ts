import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cyberPanelAPI } from '@/lib/directadmin-adapter';
import { panelBridgeStaffGate } from '@/lib/panel-api-auth';

/**
 * Proxy seguro: browser → esta rota (sessão Supabase) → API DirectAdmin no servidor.
 * Substitui `/api/server-exec` + comandos SSH para acções suportadas pelo directadmin-adapter.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    const body = await req.json();
    const action = body.action as string;
    const params = (body.params || {}) as Record<string, any>;
    const timeoutMs = body.timeoutMs as number | undefined;

    if (!action) {
      return NextResponse.json({ success: false, error: 'action em falta' }, { status: 400 });
    }

    const gate = panelBridgeStaffGate(session, action);
    if (gate) return gate;

    let data: unknown;

    switch (action) {
      case 'listWebsites':
        data = await cyberPanelAPI.listWebsites(timeoutMs);
        break;
      case 'listUsers':
        data = await cyberPanelAPI.listUsers();
        break;
      case 'listPackages':
        data = await cyberPanelAPI.listPackages();
        break;
      case 'createWebsite':
        data = await cyberPanelAPI.createWebsite(params);
        break;
      case 'suspendWebsite':
        data = await cyberPanelAPI.suspendWebsite(params.domain);
        break;
      case 'unsuspendWebsite':
        data = await cyberPanelAPI.unsuspendWebsite(params.domain);
        break;
      case 'deleteWebsite':
        data = await cyberPanelAPI.deleteWebsite(params.domain);
        break;
      case 'modifyWebsite':
        data = await cyberPanelAPI.modifyWebsite(params);
        break;
      case 'listEmails':
        data = await cyberPanelAPI.listEmails(params.domain);
        break;
      case 'createEmail':
        data = await cyberPanelAPI.createEmail(params);
        break;
      case 'deleteEmail':
        data = await cyberPanelAPI.deleteEmail(params);
        break;
      case 'suspendEmail':
        data = await cyberPanelAPI.suspendEmail(params.email);
        break;
      case 'unsuspendEmail':
        data = await cyberPanelAPI.unsuspendEmail(params.email);
        break;
      case 'serverStats':
        data = await cyberPanelAPI.getServerStats();
        break;
      case 'createUser':
        data = await cyberPanelAPI.createUser(params);
        break;
      case 'modifyUser':
        data = await cyberPanelAPI.modifyUser(params);
        break;
      case 'deleteUser':
        data = await cyberPanelAPI.deleteUser(params);
        break;
      case 'listDNS':
        data = await cyberPanelAPI.listDNS(params.domain);
        break;
      case 'listSubdomains':
        data = await cyberPanelAPI.listSubdomains(params.domain);
        break;
      case 'createSubdomain':
        data = await cyberPanelAPI.createSubdomain(params.domain, params.subdomain);
        break;
      case 'deleteSubdomain':
        data = await cyberPanelAPI.deleteSubdomain(params.domain, params.subdomain);
        break;
      case 'listDatabases':
        data = await cyberPanelAPI.listDatabases(params.domain);
        break;
      case 'createDatabase':
        data = await cyberPanelAPI.createDatabase(params);
        break;
      case 'deleteDatabase':
        data = await cyberPanelAPI.deleteDatabase(params);
        break;
      case 'listFTPAccounts':
        data = await cyberPanelAPI.listFTPAccounts(params.domain);
        break;
      case 'createFTPAccount':
        data = await cyberPanelAPI.createFTPAccount(params);
        break;
      case 'deleteFTPAccount':
        data = await cyberPanelAPI.deleteFTPAccount(params);
        break;
      case 'changeEmailPassword':
        data = await cyberPanelAPI.changeEmailPassword(params);
        break;
      case 'setEmailLimits':
        data = await cyberPanelAPI.setEmailLimits(params);
        break;
      case 'getEmailForwarding':
        data = await cyberPanelAPI.getEmailForwarding(params);
        break;
      case 'addEmailForwarding':
        data = await cyberPanelAPI.addEmailForwarding(params);
        break;
      case 'getCatchAllEmail':
        data = await cyberPanelAPI.getCatchAllEmail(params.domain);
        break;
      case 'setCatchAllEmail':
        data = await cyberPanelAPI.setCatchAllEmail(params);
        break;
      case 'getPatternForwarding':
        data = await cyberPanelAPI.getPatternForwarding(params.domain);
        break;
      case 'addPatternForwarding':
        data = await cyberPanelAPI.addPatternForwarding(params);
        break;
      case 'getPlusAddressing':
        data = await cyberPanelAPI.getPlusAddressing(params.domain);
        break;
      case 'togglePlusAddressing':
        data = await cyberPanelAPI.togglePlusAddressing(params);
        break;
      case 'enableDKIM':
        data = await cyberPanelAPI.enableDKIM(params.domain);
        break;
      case 'getDKIMStatus':
        data = await cyberPanelAPI.getDKIMStatus(params.domain);
        break;
      case 'issueSSL':
        data = await cyberPanelAPI.issueSSL(params.domain);
        break;
      case 'getPHPConfig':
        data = await cyberPanelAPI.getPHPConfig(params.domain);
        break;
      case 'savePHPConfig':
        data = await cyberPanelAPI.savePHPConfig(params);
        break;
      case 'changePHPVersion':
        data = await cyberPanelAPI.changePHPVersion(params);
        break;
      case 'getFirewallStatus':
        data = await cyberPanelAPI.getFirewallStatus();
        break;
      case 'toggleFirewall':
        data = await cyberPanelAPI.toggleFirewall(params);
        break;
      case 'getModSecurityStatus':
        data = await cyberPanelAPI.getModSecurityStatus();
        break;
      case 'toggleModSecurity':
        data = await cyberPanelAPI.toggleModSecurity(params);
        break;
      case 'getBlockedIPs':
        data = await cyberPanelAPI.getBlockedIPs();
        break;
      case 'blockIP':
        data = await cyberPanelAPI.blockIP(params);
        break;
      case 'unblockIP':
        data = await cyberPanelAPI.unblockIP(params);
        break;
      case 'listACLs':
        data = await cyberPanelAPI.listACLs();
        break;
      case 'createACL':
        data = await cyberPanelAPI.createACL(params);
        break;
      case 'deleteACL':
        data = await cyberPanelAPI.deleteACL(params);
        break;
      case 'listWordPress':
        data = await cyberPanelAPI.listWordPress(params.domain);
        break;
      case 'listWPPlugins':
        data = await cyberPanelAPI.listWPPlugins(params);
        break;
      case 'installWPPlugin':
        data = await cyberPanelAPI.installWPPlugin(params);
        break;
      case 'installWordPress':
        data = await cyberPanelAPI.installWordPress(params);
        break;
      case 'toggleWPPlugin':
        data = await cyberPanelAPI.toggleWPPlugin(params);
        break;
      case 'listWPBackups':
        data = await cyberPanelAPI.listWPBackups(params.domain);
        break;
      case 'restoreWPBackup':
        data = await cyberPanelAPI.restoreWPBackup(params);
        break;
      case 'createRemoteBackup':
        data = await cyberPanelAPI.createRemoteBackup(params);
        break;
      case 'configDefaultNameservers':
        data = await cyberPanelAPI.configDefaultNameservers(params);
        break;
      case 'createNameserver':
        data = await cyberPanelAPI.createNameserver(params);
        break;
      case 'createDNSZone':
        data = await cyberPanelAPI.createDNSZone(params);
        break;
      case 'deleteDNSZone':
        data = await cyberPanelAPI.deleteDNSZone(params);
        break;
      case 'resetDNSConfigurations':
        data = await cyberPanelAPI.resetDNSConfigurations(params.domain);
        break;
      case 'configCloudFlare':
        data = await cyberPanelAPI.configCloudFlare(params);
        break;
      case 'generateAPIToken':
        data = await cyberPanelAPI.generateAPIToken();
        break;
      case 'execCommand': {
        const out = await cyberPanelAPI.execCommand(params.command || '');
        data =
          typeof out === 'object' && out !== null && 'output' in (out as object)
            ? (out as { output?: string }).output ?? ''
            : out;
        break;
      }
      default:
        return NextResponse.json(
          {
            success: false,
            error: `Acção "${action}" não suportada pelo painel DirectAdmin. Defina NEXT_PUBLIC_PANEL_BACKEND=ssh para o modo legacy (SSH/CyberPanel).`,
          },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[panel-bridge]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
