import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { resolveHostingOwner, hostingProvider } from '@/lib/hosting-resolver';
import * as hestiaAdapter from '@/lib/hestia-adapter';
import { directAdminHostingAPI } from '@/lib/directadmin-adapter';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  try {
    const { action, params = {} } = await req.json();

    switch (action) {
      case 'listEmails': {
        if (!params.domain) {
          return NextResponse.json({ success: false, error: 'domain é obrigatório' }, { status: 400 });
        }

        const domain = String(params.domain);
        if (hostingProvider === 'hestia') {
          const owner = await resolveHostingOwner(domain);
          const hestiaAdmin = (process.env.HESTIA_USER || 'vdadmin').trim();
          let rows = await hestiaAdapter.listMailAccounts(owner, domain);
          if (rows.length === 0 && owner !== hestiaAdmin) {
            rows = await hestiaAdapter.listMailAccounts(hestiaAdmin, domain);
          }
          const emails = rows.map((account) => `${account.account}@${domain}`);
          return NextResponse.json({
            success: true,
            emails,
            data: emails.map((email) => ({ email, domain })),
          });
        }

        const accounts = await directAdminHostingAPI.listEmails(domain);
        return NextResponse.json({
          success: true,
          emails: accounts.map((account) => account.email),
          data: accounts,
        });
      }

      case 'wpAutoLogin': {
        if (!params.domain) {
          return NextResponse.json({ success: false, error: 'domain é obrigatório' }, { status: 400 });
        }

        return NextResponse.json({
          success: false,
          unsupported: true,
          fallbackUrl: `https://${params.domain}/wp-admin`,
          error: 'Auto-login WordPress ainda não está implementado neste painel',
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Acção "${action}" não suportada` },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
