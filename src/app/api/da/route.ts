import { NextRequest, NextResponse } from 'next/server';
import { cyberPanelAPI } from '@/lib/directadmin-adapter';
import { createClient } from '@/utils/supabase/server';

/**
 * API DirectAdmin - Rota unificada para operações no painel DirectAdmin
 * Substitui as chamadas diretas a /api/server-exec
 */

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    // Verificar autenticação
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado - sessão não encontrada' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { action, params = {}, timeoutMs } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'action é obrigatória' },
        { status: 400 }
      );
    }

    console.log(`[DA API] ${action}`, JSON.stringify(params).substring(0, 200));

    let data: any;

    switch (action) {
      // ═══════════════════════════════════════════════════════════════════════
      // WEBSITES / DOMÍNIOS
      // ═══════════════════════════════════════════════════════════════════════
      case 'listWebsites':
        data = await cyberPanelAPI.listWebsites(timeoutMs);
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

      // ═══════════════════════════════════════════════════════════════════════
      // SUBDOMÍNIOS
      // ═══════════════════════════════════════════════════════════════════════
      case 'listSubdomains':
        data = await cyberPanelAPI.listSubdomains(params.domain);
        break;
      case 'createSubdomain':
        data = await cyberPanelAPI.createSubdomain(params.domain, params.subdomain);
        break;
      case 'deleteSubdomain':
        data = await cyberPanelAPI.deleteSubdomain(params.domain, params.subdomain);
        break;

      // ═══════════════════════════════════════════════════════════════════════
      // PACOTES
      // ═══════════════════════════════════════════════════════════════════════
      case 'listPackages':
        data = await cyberPanelAPI.listPackages();
        break;
      case 'createPackage':
        data = await cyberPanelAPI.createPackage(params);
        break;
      case 'deletePackage':
        data = await cyberPanelAPI.deletePackage(params);
        break;

      // ═══════════════════════════════════════════════════════════════════════
      // UTILIZADORES
      // ═══════════════════════════════════════════════════════════════════════
      case 'listUsers':
        data = await cyberPanelAPI.listUsers();
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

      // ═══════════════════════════════════════════════════════════════════════
      // EMAILS
      // ═══════════════════════════════════════════════════════════════════════
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
      case 'changeEmailPassword':
        data = await cyberPanelAPI.changeEmailPassword(params);
        break;
      case 'setEmailLimits':
        data = await cyberPanelAPI.setEmailLimits(params);
        break;

      // ═══════════════════════════════════════════════════════════════════════
      // BASES DE DADOS
      // ═══════════════════════════════════════════════════════════════════════
      case 'listDatabases':
        data = await cyberPanelAPI.listDatabases(params.domain);
        break;
      case 'createDatabase':
        data = await cyberPanelAPI.createDatabase(params);
        break;
      case 'deleteDatabase':
        data = await cyberPanelAPI.deleteDatabase(params);
        break;

      // ═══════════════════════════════════════════════════════════════════════
      // FTP
      // ═══════════════════════════════════════════════════════════════════════
      case 'listFTPAccounts':
        data = await cyberPanelAPI.listFTPAccounts(params.domain);
        break;
      case 'createFTPAccount':
        data = await cyberPanelAPI.createFTPAccount(params);
        break;
      case 'deleteFTPAccount':
        data = await cyberPanelAPI.deleteFTPAccount(params);
        break;

      // ═══════════════════════════════════════════════════════════════════════
      // SSL
      // ═══════════════════════════════════════════════════════════════════════
      case 'issueSSL':
        data = await cyberPanelAPI.issueSSL(params.domain);
        break;

      // ═══════════════════════════════════════════════════════════════════════
      // DNS
      // ═══════════════════════════════════════════════════════════════════════
      case 'listDNS':
        data = await cyberPanelAPI.listDNS(params.domain);
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
      case 'enableDKIM':
        data = await cyberPanelAPI.enableDKIM(params.domain);
        break;
      case 'getDKIMStatus':
        data = await cyberPanelAPI.getDKIMStatus(params.domain);
        break;

      // ═══════════════════════════════════════════════════════════════════════
      // SEGURANÇA / FIREWALL
      // ═══════════════════════════════════════════════════════════════════════
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
      case 'blockIP':
        data = await cyberPanelAPI.blockIP(params);
        break;
      case 'unblockIP':
        data = await cyberPanelAPI.unblockIP(params);
        break;

      // ═══════════════════════════════════════════════════════════════════════
      // ESTATÍSTICAS / INFO
      // ═══════════════════════════════════════════════════════════════════════
      case 'serverStats':
        data = await cyberPanelAPI.getServerStats();
        break;

      // ═══════════════════════════════════════════════════════════════════════
      // WORDPRESS
      // ═══════════════════════════════════════════════════════════════════════
      case 'listWordPress':
        data = await cyberPanelAPI.listWordPress(params.domain);
        break;

      // ═══════════════════════════════════════════════════════════════════════
      // AÇÕES NÃO SUPORTADAS
      // ═══════════════════════════════════════════════════════════════════════
      default:
        return NextResponse.json(
          {
            success: false,
            error: `Ação "${action}" não suportada pela API DirectAdmin.`,
            supported: false
          },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[DA API ERROR]', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// GET para ações simples
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'action é obrigatória' },
        { status: 400 }
      );
    }

    console.log(`[DA API GET] ${action}`);

    let data: any;

    switch (action) {
      case 'listUsers':
        data = await cyberPanelAPI.listUsers();
        break;
      case 'listPackages':
        data = await cyberPanelAPI.listPackages();
        break;
      case 'listWebsites':
        data = await cyberPanelAPI.listWebsites();
        break;
      default:
        return NextResponse.json(
          { success: false, error: `GET action "${action}" não suportada` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[DA API GET ERROR]', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
