import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { hestiaCall } from '@/lib/hestia-client';
import * as hestia from '@/lib/hestia-adapter';
import { camposHestia as camposDoFormulario } from '@/lib/pacote-hestia';
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
  acao: 'suspender' | 'reativar' | 'apagar' | 'pacote' | 'senha' | 'criar' | 'mover' | 'tipo' | 'pacote-gravar' | 'pacote-apagar';
  /** pacote-gravar: limites e funcionalidades do formulário (como em paginas/pacotes.tsx); editar = o pacote já existe */
  gravar?: {
    nome: string;
    /** nome antigo, ao mudar o nome de um pacote que já existe */
    de?: string;
    editar?: boolean;
    lim: Record<string, { v: string; unl: boolean; unit?: string }>;
    feats: Record<string, boolean>;
    /** recursos (CPU, memória, swap…) e campos de texto do pacote (shell, NS, modelos…) */
    rec?: Record<string, { v: string; unl: boolean; unit?: string }>;
    hestia?: Record<string, string>;
  };
  /** pacote-apagar */
  pacotes?: string[];
  contas?: string[];
  pacote?: string;
  senha?: string;
  /** mover: revendedor (ou administrador) que fica com os clientes */
  para?: string;
  /** pacote: descer de plano mesmo que a conta já use mais do que o pacote novo deixa */
  forcar?: boolean;
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

  /** Pacote que esta sessão pode atribuir: existe no servidor, não é "system" e, para revendedores, é um dos Pro-… (Pro-Basico,
   *  Pro-Premium, Pro-Business — Silva, 22/10/2026) e não um pacote de revenda (mesma regra do site: excludeResellerSelfPackages) */
  const pacotePermitido = (p: string) =>
    !!p && p !== 'system' && !!srv.packages[p] && (admin || (/^pro-/i.test(p) && excludeResellerSelfPackages([{ packageName: p }], [], eu).length === 1));

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

  // Pacotes de cliente no servidor (Admin › Pacotes): criar, editar e apagar — só o administrador
  if (corpo.acao === 'pacote-gravar' || corpo.acao === 'pacote-apagar') {
    if (!admin) return NextResponse.json({ erro: 'Só o administrador cria, edita ou apaga pacotes.' }, { status: 403 });
    if (corpo.acao === 'pacote-apagar') {
      for (const n of corpo.pacotes || []) {
        const nome = String(n);
        const usam = Object.entries(srv.users).filter(([, x]) => x.PACKAGE === nome).map(([u]) => u);
        if (usam.length) {
          falhas.push({ conta: nome, erro: 'em uso por ' + usam.join(', ') });
          continue;
        }
        const r = await hestia.apagarPacote(nome);
        if (r.ok) feitas.push(nome);
        else falhas.push({ conta: nome, erro: r.error || 'o servidor recusou' });
      }
    } else {
      const g = corpo.gravar;
      if (!g?.nome) return NextResponse.json({ erro: 'Escreva o nome do pacote.' }, { status: 400 });
      const nome = String(g.nome);
      const de = g.de && String(g.de) !== nome ? String(g.de) : undefined;
      const { campos, erros, exatos } = camposDoFormulario(g.lim || {}, g.feats || {}, g.rec || {}, g.hestia || {});
      if (erros.length) {
        // o que o Hestia recusaria, dito antes de lhe enviar nada
        falhas.push({ conta: nome, erro: erros.join(' ') });
      } else {
        const r = await hestia.gravarPacote(nome, campos, g.editar === true, de, exatos);
        if (!r.ok) falhas.push({ conta: nome, erro: r.error || 'o servidor recusou' });
        else {
          feitas.push(nome);
          if (g.editar === true) {
            // como no Hestia: o que se muda no pacote passa já para as contas que o têm (com FORCE: a conta que já usa mais
            // do que o limite novo fica com o que tem, só não pode criar mais até ficar dentro dele). Ao mudar o nome, o
            // Hestia já passou as contas para o nome novo; isto garante as que ficaram para trás.
            const origem = de || nome;
            const contasDoPacote = Object.entries(srv.users).filter(([, x]) => x.PACKAGE === origem).map(([u]) => u);
            for (const u of contasDoPacote) {
              const x = await hestia.changeUserPackage(u, nome, true);
              if (!x.ok) falhas.push({ conta: u, erro: x.error || 'não foi possível aplicar o pacote a esta conta' });
            }
          }
        }
      }
    }
    if (feitas.length) esquecerLeitura();
    return NextResponse.json({ feitas, falhas }, { status: falhas.length && !feitas.length ? 400 : 200 });
  }

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
      // forcar: descer de plano mesmo que a conta use mais do que o pacote novo deixa (o painel pergunta antes)
      for (const u of contas) await correr(u, () => hestia.changeUserPackage(u, p, corpo.forcar === true));
      break;
    }
    case 'senha': {
      const s = String(corpo.senha || '');
      if (s.length < 8) return NextResponse.json({ erro: 'A palavra-passe precisa de pelo menos 8 caracteres.' }, { status: 400 });
      for (const u of contas)
        await correr(u, async () => {
          const r = await hestia.changePassword(u, s);
          if (!r.ok) return r;
          if (sb) {
            try {
              // Sincroniza com Supabase Auth para permitir entrar no painel e no site
              const { data: prof } = await sb
                .from('profiles')
                .select('id, user_id, email')
                .or(`da_username.eq.${u},name.eq.${u}`)
                .maybeSingle();

              let authUserId = prof?.user_id || prof?.id;
              if (!authUserId) {
                const { data: pu } = await sb
                  .from('panel_users')
                  .select('auth_user_id')
                  .eq('username', u)
                  .maybeSingle();
                if (pu?.auth_user_id) authUserId = pu.auth_user_id;
              }

              if (authUserId) {
                await sb.auth.admin.updateUserById(authUserId, { password: s });
              } else {
                // a conta ainda não tem login do site (ex.: mltmark, vinda do servidor sem compra no site): cria-o já
                // com esta palavra-passe, para a conta poder entrar (Silva, 17/10/2026)
                const { criarLoginDaConta } = await import('@/lib/vhost-login-da-conta');
                const criado = await criarLoginDaConta(sb, u, s);
                if (!criado.ok) return { ok: false, error: 'A palavra-passe mudou no servidor, mas a conta não tem login do site: ' + criado.erro };
                return r;
              }

              // Atualiza credenciais guardadas no perfil e no registo do painel
              const { encryptDaSecret } = await import('@/lib/da-credential-store');
              const enc = encryptDaSecret(s);
              await sb.from('profiles').update({ da_password_encrypted: enc }).or(`da_username.eq.${u},name.eq.${u}`);
              const updatePu: Record<string, unknown> = { da_password_encrypted: enc };
              if (authUserId) updatePu.auth_user_id = authUserId;
              await sb.from('panel_users').update(updatePu).eq('username', u);
            } catch (err) {
              console.error('[acoes/senha] Erro ao sincronizar senha com Supabase:', err);
            }
          }
          return r;
        });
      break;
    }
    case 'criar': {
      const c = corpo.criar;
      if (!c) return NextResponse.json({ erro: 'Faltam os dados da conta.' }, { status: 400 });
      const u = String(c.user || '').trim().toLowerCase();
      const b = bloqueio(u, true);
      if (b) return NextResponse.json({ erro: 'Não foi criada: ' + b + '.', falhas: [{ conta: u, erro: b }] }, { status: 400 });
      // nenhuma conta sem e-mail (Silva, 17/10/2026): é ele o login do site e do painel
      const { emailDeContaValido, SEM_EMAIL } = await import('@/lib/hestia-adapter');
      if (!emailDeContaValido(c.email)) return NextResponse.json({ erro: c.email ? 'E-mail inválido.' : SEM_EMAIL }, { status: 400 });
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
      // a conta nasce já com login do site (o e-mail escrito e esta palavra-passe): sem ele não entrava no painel
      if (sb) {
        const { criarLoginDaConta } = await import('@/lib/vhost-login-da-conta');
        const login = await criarLoginDaConta(sb, u, c.senha, c.email).catch((e: unknown) => ({ ok: false as const, erro: e instanceof Error ? e.message : String(e) }));
        if (!login.ok) falhas.push({ conta: u, erro: 'conta criada, mas sem login do site: ' + login.erro });
      }
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
