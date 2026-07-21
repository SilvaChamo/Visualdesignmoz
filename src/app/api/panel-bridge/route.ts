import { NextRequest, NextResponse } from 'next/server';
import { directAdminHostingAPI } from '@/lib/directadmin-adapter';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { action, params = {} } = await req.json();

    switch (action) {
      case 'listEmails': {
        if (!params.domain) {
          return NextResponse.json({ success: false, error: 'domain é obrigatório' }, { status: 400 });
        }

        const accounts = await directAdminHostingAPI.listEmails(params.domain);
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

        // DirectAdmin/WordPress does not expose a generic safe auto-login URL.
        // The frontend already falls back to this URL when success is false.
        return NextResponse.json({
          success: false,
          unsupported: true,
          fallbackUrl: `https://${params.domain}/wp-admin`,
          error: 'Auto-login WordPress ainda não está implementado para DirectAdmin',
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Acção "${action}" não suportada pela bridge DirectAdmin` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Erro interno' }, { status: 500 });
  }
}
