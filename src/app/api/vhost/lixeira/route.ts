import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { apagarDaLixeira, idLixeiraValido, lerInfoLixeira, listarLixeira, marcarReposto, reporNoServidor, reporPainel } from '@/lib/lixeira-servidor';
import { esquecerLeitura } from '@/lib/vhost-servidor';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/lixeira — Admin › Lixeira (só o administrador): os sites e as contas apagados, guardados em /backup/lixeira no servidor
 * (ver lib/lixeira-servidor.ts). Nada do que se apaga no painel desaparece logo: daqui repõe-se ou apaga-se de vez.
 * GET                                       → { itens: [{ id, tipo, conta, dominio, data, origem, tam, bases }], total }
 * POST { acao: 'repor' | 'apagar', ids }     → { feitos: string[], falhas: { id, erro }[], avisos: string[] }
 */

async function soAdmin() {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return NextResponse.json({ erro: 'Inicie sessão no site.' }, { status: auth.error.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ erro: 'Só o administrador do servidor vê esta página.' }, { status: 403 });
  return null;
}

export async function GET() {
  const recusa = await soAdmin();
  if (recusa) return recusa;
  try {
    const itens = (await listarLixeira()).map((i) => ({
      id: i.id,
      tipo: i.tipo,
      conta: i.conta,
      dominio: i.dominio,
      data: i.data,
      origem: i.origem,
      tam: i.tam,
      bases: i.bases || [],
    }));
    return NextResponse.json({ itens, total: itens.length }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ erro: 'Sem ligação ao servidor.' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const recusa = await soAdmin();
  if (recusa) return recusa;
  const c = (await req.json().catch(() => ({}))) as { acao?: unknown; ids?: unknown };
  const acao = String(c.acao || '');
  const ids = [...new Set(Array.isArray(c.ids) ? c.ids.filter(idLixeiraValido) : [])].slice(0, 50);
  if (!['apagar', 'repor'].includes(acao) || !ids.length) return NextResponse.json({ erro: 'Escolha o que repor ou apagar.' }, { status: 400 });

  const feitos: string[] = [];
  const falhas: { id: string; erro: string }[] = [];
  const avisos: string[] = [];
  try {
    for (const id of ids) {
      if (acao === 'apagar') {
        const r = await apagarDaLixeira(id);
        if (r.ok) feitos.push(id);
        else falhas.push({ id, erro: r.error || 'Não foi possível apagar.' });
        continue;
      }
      const info = await lerInfoLixeira(id);
      if (!info) {
        falhas.push({ id, erro: 'Já não existe na lixeira.' });
        continue;
      }
      const r = await reporNoServidor(info);
      if (!r.ok) {
        falhas.push({ id, erro: r.error || 'Não foi possível repor.' });
        continue;
      }
      avisos.push(...(await reporPainel(info.painel)));
      if (info.bases?.length) avisos.push(`As bases de dados ${info.bases.join(', ')} ficaram guardadas em /backup/lixeira/_repostos/${id} (.sql.gz) e não foram repostas sozinhas.`);
      await marcarReposto(id);
      feitos.push(id);
    }
    esquecerLeitura();
    return NextResponse.json({ feitos, falhas, avisos });
  } catch {
    return NextResponse.json({ erro: 'Sem ligação ao servidor.', feitos, falhas }, { status: 502 });
  }
}
