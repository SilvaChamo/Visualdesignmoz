import { NextResponse } from 'next/server';
import { versaoBuild } from '@/lib/versao-build';

export const dynamic = 'force-dynamic';

// Pública e leve: o painel VisualHost pergunta de vez em quando que versão o servidor está a servir para, depois de
// uma publicação, passar sozinho para a versão nova (ver VisualHostApp, "versão nova"). Só devolve o BUILD_ID.
export function GET() {
  return NextResponse.json({ versao: versaoBuild() }, { headers: { 'Cache-Control': 'no-store' } });
}
