import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { hestiaCall } from '@/lib/hestia-client';
import * as hestia from '@/lib/hestia-adapter';
import { esquecerLeitura, lerServidor } from '@/lib/vhost-servidor';
import { esquecerRegisto } from '@/lib/vhost-dados';
import { excludeResellerSelfPackages } from '@/lib/panel-contas-enrich';
import { DOMINIO_OK, instalarWebmail, preverPassagem } from '@/lib/vhost-passar';
import { assertResellerHostingQuota } from '@/lib/panel-reseller-tier';

export const dynamic = 'force-dynamic';

/**
 * POST /api/vhost/acoes — alterações às contas do servidor (Hestia) feitas no painel VisualHost.
 *
 * Proteção combinada com o Silva (10/10/2026): por agora só mexe em contas de teste (nome a começar por
 * "teste"). As contas reais dos clientes ficam protegidas até VHOST_ACOES_TODAS=1 no ambiente.
 * Administrador: qualquer conta; revendedor: só as contas dos seus clientes.
 */
const PREFIXO_TESTE = 'teste';
const todasLiberadas = () => process.env.VHOST_ACOES_TODAS === '1';
const conta_ok = (u: string) => /^[a-z][a-z0-9_-]{2,30}$/.test(u);

type Corpo = {
  acao: 'suspender' | 'reativar' | 'apagar' | 'pacote' | 'senha' | 'criar' | 'mover' | 'tipo';
  contas?: string[];
  pacote?: string;
  senha?: string;
  /** mover: revendedor (ou administrador) que fica com os clientes */
  para?: string;
  /** tipo: admin | revenda | profissional | cliente */
  tipo?: string;
  criar?: { user: string; nome?: string; email: string; senha: string; dominio?: string; pacote: string };
};

export async function POST(req: NextRequest) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return NextResponse.json({ erro: 'Sem permissão para alterar contas.' }, { status: auth.error.status });
  let corpo: Corpo;
  try {
    corpo = (await req.json()) as Corpo;
  } catch {
    return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
  }

  const srv = await lerServidor();
  const sb = getDaSyncAdmin();
  const admin = auth.user.role === 'admin';

  // Revendedor: a sua conta do servidor e as contas dos seus clientes (panel_users.parent_username)
  let meus = new Set<string>();
  let eu = '';
  if (!admin && sb) {
    const [{ data: perfil }, { data: registo }] = await Promise.all([
      sb.from('profiles').select('da_username').eq('user_id', auth.user.id).maybeSingle(),
      sb.from('panel_users').select('username, parent_username, auth_user_id'),
    ]);
    eu = String(perfil?.da_username || (registo || []).find((r) => r.auth_user_id === auth.user.id)?.username || '').toLowerCase();
    meus = new Set((registo || []).filter((r) => eu && String(r.parent_username || '').toLowerCase() === eu).map((r) => String(r.username).toLowerCase()));
  }

  if (!admin && !eu) return NextResponse.json({ erro: 'A sua conta do site ainda não está ligada a uma conta do servidor.' }, { status: 403 });

  /** Pacote que esta sessão pode atribuir: existe no servidor, não é "system" e, para revendedores, não é um
   *  pacote de revenda (mesma regra do site: excludeResellerSelfPackages) */
  const pacotePermitido = (p: string) =>
    !!p && p !== 'system' && !!srv.packages[p] && (admin || excludeResellerSelfPackages([{ packageName: p }], [], eu).length === 1);

  /** Porque é que esta conta não pode ser alterada (ou null se pode) */
  const bloqueio = (u: string, nova = false): string | null => {
    if (!conta_ok(u)) return 'nome de conta inválido';
    if (!todasLiberadas() && !u.startsWith(PREFIXO_TESTE)) return 'por agora só se alteram contas de teste (nome a começar por "' + PREFIXO_TESTE + '")';
    if (nova) return srv.users[u] ? 'essa conta já existe' : null;
    const x = srv.users[u];
    if (!x) return 'conta não encontrada no servidor';
    if ((x.ROLE || '').toLowerCase() === 'admin' || u === (process.env.HESTIA_USER || 'vdadmin')) return 'conta de administrador do servidor';
    if (!admin && !meus.has(u)) return 'conta fora do seu painel';
    return null;
  };

  const feitas: string[] = [];
  const falhas: { conta: string; erro: string }[] = [];
  const correr = async (u: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    const b = bloqueio(u);
    if (b) return falhas.push({ conta: u, erro: b });
    const r = await fn();
    if (r.ok) feitas.push(u);
    else falhas.push({ conta: u, erro: r.error || 'o servidor recusou' });
  };

  const contas = (corpo.contas || []).map((u) => String(u).trim().toLowerCase()).filter(Boolean);
  switch (corpo.acao) {
    case 'suspender':
      for (const u of contas) await correr(u, () => hestia.suspendAccount(u));
      break;
    case 'reativar':
      for (const u of contas) await correr(u, () => hestia.unsuspendAccount(u));
      break;
    case 'apagar':
      for (const u of contas)
        await correr(u, async () => {
          const r = await hestia.deleteAccount(u);
          if (r.ok && sb) await sb.from('panel_users').delete().eq('username', u);
          esquecerRegisto();
          return r;
        });
      break;
    case 'pacote': {
      const p = String(corpo.pacote || '');
      if (!pacotePermitido(p)) return NextResponse.json({ erro: 'Esse pacote não existe ou não pode ser atribuído por esta conta.' }, { status: 403 });
      for (const u of contas) await correr(u, () => hestia.changeUserPackage(u, p));
      break;
    }
    case 'senha': {
      const s = String(corpo.senha || '');
      if (s.length < 8) return NextResponse.json({ erro: 'A palavra-passe precisa de pelo menos 8 caracteres.' }, { status: 400 });
      for (const u of contas) await correr(u, () => hestia.changePassword(u, s));
      break;
    }
    case 'criar': {
      const c = corpo.criar;
      if (!c) return NextResponse.json({ erro: 'Faltam os dados da conta.' }, { status: 400 });
      const u = String(c.user || '').trim().toLowerCase();
      const b = bloqueio(u, true);
      if (b) return NextResponse.json({ erro: 'Não foi criada: ' + b + '.', falhas: [{ conta: u, erro: b }] }, { status: 400 });
      if (!/^\S+@\S+\.\S+$/.test(c.email || '')) return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 });
      if ((c.senha || '').length < 8) return NextResponse.json({ erro: 'A palavra-passe precisa de pelo menos 8 caracteres.' }, { status: 400 });
      if (!pacotePermitido(String(c.pacote || ''))) return NextResponse.json({ erro: 'Esse pacote não existe ou não pode ser atribuído por esta conta.' }, { status: 403 });
      // Domínio escrito: tem de ser válido e ainda não existir no servidor. Um domínio que já está na conta do
      // administrador (ou na do revendedor que cria) cria-se sem domínio e passa depois, pelo botão "Passar para outra
      // conta" (/api/vhost/passar, com cópia e desfazer); verifica-se antes de criar a conta, para não ficar a meio.
      const d = String(c.dominio || '').trim().toLowerCase();
      if (d) {
        if (!DOMINIO_OK.test(d)) return NextResponse.json({ erro: 'Domínio inválido.' }, { status: 400 });
        const onde = await preverPassagem(d);
        if ('erro' in onde) return NextResponse.json({ erro: onde.erro }, { status: 400 });
        if (onde.dono) return NextResponse.json({ erro: 'O domínio ' + d + ' já está no servidor (conta ' + onde.dono + '). Crie a conta sem domínio e passe-o depois para ela.' }, { status: 409 });
      }
      // Revendedor: limite de contas de cliente do seu plano (Essencial/Expandido), contado no servidor
      if (!admin) {
        const quota = await assertResellerHostingQuota({ userId: auth.user.id, daUsername: eu });
        if (!quota.ok) return NextResponse.json({ erro: quota.error }, { status: 403 });
      }
      // Só a conta e o site no Hestia (sem Let's Encrypt nem configuração de DNS/e-mail em serviços externos)
      const r = await hestiaCall('v-add-user', [u, c.senha, c.email, c.pacote]);
      if (!r.ok) return NextResponse.json({ erro: 'O servidor recusou: ' + (r.error || 'erro'), falhas: [{ conta: u, erro: r.error || 'erro' }] }, { status: 502 });
      if (c.nome) {
        const [primeiro, ...resto] = c.nome.trim().split(/\s+/);
        await hestiaCall('v-change-user-name', [u, primeiro, resto.join(' ') || primeiro]).catch(() => null);
      }
      if (d) {
        const w = await hestiaCall('v-add-web-domain', [u, d]);
        if (!w.ok) falhas.push({ conta: u, erro: 'conta criada, mas o domínio não: ' + (w.error || 'erro') });
        // webmail em https://<domínio>/webmail, como nos outros sites (antes ficava por pôr à mão)
        else if (!(await instalarWebmail(u, d))) falhas.push({ conta: u, erro: 'conta e domínio criados, mas a regra do webmail não foi posta' });
      }
      if (sb) await sb.from('panel_users').upsert({ username: u, parent_username: admin ? null : eu || null, email: c.email, package_name: c.pacote, created_at: new Date().toISOString() }, { onConflict: 'username' });
      esquecerRegisto();
      feitas.push(u);
      break;
    }
    case 'mover': {
      // Clientes passam a outro revendedor (registo do site: panel_users.parent_username). Só o administrador.
      if (!admin) return NextResponse.json({ erro: 'Só o administrador move clientes entre revendedores.' }, { status: 403 });
      if (!sb) return NextResponse.json({ erro: 'Registo do site indisponível.' }, { status: 503 });
      const para = String(corpo.para || '').trim().toLowerCase();
      const destino = srv.users[para];
      if (!destino) return NextResponse.json({ erro: 'Destino inexistente.' }, { status: 400 });
      const destinoAdmin = (destino.ROLE || '').toLowerCase() === 'admin' || para === (process.env.HESTIA_USER || 'vdadmin');
      for (const u of contas) {
        if (u === para) {
          falhas.push({ conta: u, erro: 'é o próprio destino' });
          continue;
        }
        await correr(u, async () => {
          const { error } = await sb.from('panel_users').upsert({ username: u, parent_username: destinoAdmin ? null : para }, { onConflict: 'username' });
          return { ok: !error, error: error?.message };
        });
      }
      if (feitas.length) esquecerRegisto();
      break;
    }
    case 'tipo': {
      // Tipo de conta = papel do utilizador do site ligado à conta (profiles.role). Só o administrador.
      if (!admin) return NextResponse.json({ erro: 'Só o administrador muda o tipo de conta.' }, { status: 403 });
      if (!sb) return NextResponse.json({ erro: 'Registo do site indisponível.' }, { status: 503 });
      const papel = ({ admin: 'admin', revenda: 'reseller', profissional: 'profissional', cliente: 'client' } as Record<string, string>)[String(corpo.tipo || '')];
      if (!papel) return NextResponse.json({ erro: 'Tipo inválido.' }, { status: 400 });
      const { data: registo } = await sb.from('panel_users').select('username, auth_user_id');
      for (const u of contas) {
        await correr(u, async () => {
          const authId = (registo || []).find((r) => String(r.username).toLowerCase() === u)?.auth_user_id;
          const q = sb.from('profiles').update({ role: papel, updated_at: new Date().toISOString() });
          const { data, error } = await (authId ? q.eq('user_id', authId) : q.eq('da_username', u)).select('user_id');
          if (error) return { ok: false, error: error.message };
          return data?.length ? { ok: true } : { ok: false, error: 'esta conta não tem utilizador do site ligado' };
        });
      }
      if (feitas.length) esquecerRegisto();
      break;
    }
    default:
      return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
  }

  if (feitas.length) esquecerLeitura();
  return NextResponse.json({ feitas, falhas }, { status: feitas.length || !falhas.length ? 200 : 400 });
}
