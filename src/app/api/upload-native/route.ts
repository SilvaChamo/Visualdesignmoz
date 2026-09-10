import { NextRequest, NextResponse } from 'next/server';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { isShellSafeHomePath, assertPathsOwnedByCaller } from '@/lib/panel-fs-ownership';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminOrReseller();
    if ('error' in auth) return auth.error;

    const pathHeader = req.headers.get('x-file-path');
    const path = pathHeader ? decodeURIComponent(pathHeader) : null;

    if (!path || !isShellSafeHomePath(path)) {
      return NextResponse.json({ success: false, error: 'Destino inválido' }, { status: 400 });
    }

    if (auth.user.role !== 'admin' && !(await assertPathsOwnedByCaller([path], auth.user.id))) {
      return NextResponse.json({ success: false, error: 'Caminho fora do seu painel.' }, { status: 403 });
    }

    if (!req.body) {
      return NextResponse.json({ success: false, error: 'Sem conteúdo' }, { status: 400 });
    }

    // Buffer the full ReadableStream before upload — avoids race conditions
    // where the SSH stdin closes before all chunks arrive.
    const chunks: Uint8Array[] = [];
    const reader = (req.body as ReadableStream).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const fileBuffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));

    // Ensure the destination directory exists before writing
    const destDir = path.substring(0, path.lastIndexOf('/'));
    if (destDir) {
      try {
        await executeServerCommand(`mkdir -p "${destDir}"`);
      } catch {
        // best-effort; if it fails the upload will surface the real error
      }
    }

    // Upload via SSH stdin (cat >)
    const { uploadFileViaSsh } = await import('@/lib/server-ssh-exec');
    await uploadFileViaSsh(path, fileBuffer);

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
