import { NextResponse } from 'next/server';
import { getMaintenanceState } from '@/lib/maintenance-state';

export const dynamic = 'force-dynamic';

// Pública: o MaintenanceBanner (layout raiz) e a página /manutencao precisam de
// saber se a manutenção está activa, mesmo para visitantes sem sessão. Só expõe
// o estado e a mensagem — métricas, processos e acções sobre o servidor ficam
// em /api/admin/system-status, que exige admin.
export async function GET() {
  const { active, message } = getMaintenanceState();
  return NextResponse.json({ maintenance: { active, message } });
}
