import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { desligarDoisPassos, guardarHashes, hashCodigo, hashesDe, igual, temSegredo, tentativaPermitida } from '@/lib/dois-passos-codigos';

export const dynamic = 'force-dynamic';

/**
 * POST /api/vhost/doisp/recuperar { codigo } — entrar sem a aplicação de autenticação, com um código de recuperação
 * (Silva, 21/10/2026). É a única rota do painel que aceita a sessão só com a palavra-passe (o proxy deixa-a passar): a
 * sessão tem de ser válida, o código é de uso único e, se estiver certo, os 2 passos da conta ficam desligados (a pessoa
 * volta a ligá-los com a aplicação nova). Poucas tentativas por pessoa.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
  const sb = getDaSyncAdmin();
  if (!sb) return NextResponse.json({ erro: 'Registo do site indisponível.' }, { status: 503 });
  if (!temSegredo()) return NextResponse.json({ erro: 'Códigos de recuperação indisponíveis neste servidor.' }, { status: 503 });
  if (!tentativaPermitida(user.id)) return NextResponse.json({ erro: 'Demasiadas tentativas. Tente novamente daqui a 15 minutos.' }, { status: 429 });
  const c = (await req.json().catch(() => ({}))) as { codigo?: unknown };
  const codigo = typeof c.codigo === 'string' ? c.codigo : '';
  if (codigo.replace(/[^a-zA-Z0-9]/g, '').length < 8) return NextResponse.json({ erro: 'Código de recuperação inválido.' }, { status: 400 });
  const { data } = await sb.auth.admin.getUserById(user.id);
  const hashes = hashesDe(data?.user?.app_metadata);
  const h = hashCodigo(user.id, codigo);
  if (!hashes.some((x) => igual(x, h))) return NextResponse.json({ erro: 'Código de recuperação errado ou já usado.' }, { status: 400 });
  // gasta o código e desliga os 2 passos (os outros códigos deixam de servir: a conta fica sem 2 passos)
  await guardarHashes(sb, user.id, hashes.filter((x) => !igual(x, h)));
  await desligarDoisPassos(sb, user.id);
  console.warn('[vhost/doisp] entrada com código de recuperação; 2 passos desligados na conta', user.id);
  return NextResponse.json({ ok: true });
}
