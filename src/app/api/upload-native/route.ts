import { NextRequest, NextResponse } from 'next/server';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminOrReseller();
    if ('error' in auth) return auth.error;

    const pathHeader = req.headers.get('x-file-path');
    const path = pathHeader ? decodeURIComponent(pathHeader) : null;

    if (!path) {
      return NextResponse.json({ success: false, error: 'Destino inválido' }, { status: 400 });
    }

    if (!req.body) {
      return NextResponse.json({ success: false, error: 'Sem conteúdo' }, { status: 400 });
    }
    
    // Upload natively via SSH stdin stream (bypassing ARG_MAX limit)
    const { uploadFileViaSsh } = await import('@/lib/server-ssh-exec');
    await uploadFileViaSsh(path, req.body as any);
    
    // Set correct permissions after upload
    try {
      await executeServerCommand(`chmod 644 "${path}"`);
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
