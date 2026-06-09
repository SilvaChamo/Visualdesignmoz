import { NextResponse } from 'next/server';
import { daRequest } from '@/lib/directadmin';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';

export async function GET(req: Request) {
  try {
    const auth = await requireAdminOrReseller();
    if ('error' in auth) return auth.error;
    const ctx = auth.user;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // List all users
    if (action === 'list') {
      // CMD_API_SHOW_ALL_USERS returns urlencoded list like list[]=user1&list[]=user2
      const response = await daRequest('CMD_API_SHOW_ALL_USERS', 'GET', {}, ctx.role, ctx);
      if (response.error) {
        return NextResponse.json({ success: false, error: response.text || 'Failed to fetch users' });
      }
      
      const users: string[] = [];
      if (response.data) {
        for (const [key, value] of Object.entries(response.data)) {
          if (key.startsWith('list')) {
            users.push(value as string);
          }
        }
      }
      return NextResponse.json({ success: true, users });
    }

    // List packages (needed for account creation)
    if (action === 'packages') {
      const type = searchParams.get('type') || 'user'; // 'user' or 'reseller'
      const cmd = type === 'reseller' ? 'CMD_API_PACKAGES_RESELLER' : 'CMD_API_PACKAGES_USER';
      const response = await daRequest(cmd, 'GET', {}, ctx.role, ctx);
      
      if (response.error) {
        return NextResponse.json({ success: false, error: response.text || 'Failed to fetch packages' });
      }

      const packages: string[] = [];
      if (response.data) {
        for (const [key, value] of Object.entries(response.data)) {
          if (key.startsWith('list')) {
            packages.push(value as string);
          }
        }
      }
      return NextResponse.json({ success: true, packages });
    }

    return NextResponse.json({ success: false, error: 'Ação inválida' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdminOrReseller();
    if ('error' in auth) return auth.error;
    const ctx = auth.user;

    const body = await req.json();
    const { type, username, email, password, domain, packageName, ip = 'shared' } = body;

    if (!type || !username || !email || !password || !domain || !packageName) {
      return NextResponse.json({ success: false, error: 'Faltam dados obrigatórios' }, { status: 400 });
    }

    // Determine command based on account type
    const cmd = type === 'reseller' ? 'CMD_API_ACCOUNT_RESELLER' : 'CMD_API_ACCOUNT_USER';

    const params = {
      action: 'create',
      username,
      email,
      passwd: password,
      passwd2: password,
      domain,
      package: packageName,
      ip,
      notify: 'no'
    };

    const response = await daRequest(cmd, 'POST', params, ctx.role, ctx);

    if (response.error) {
      return NextResponse.json({ success: false, error: response.details || response.text || 'Erro ao criar conta' });
    }

    return NextResponse.json({ 
      success: true, 
      message: `${type === 'reseller' ? 'Revendedor' : 'Utilizador'} criado com sucesso!`
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
