import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { clientesDaRevenda } from '@/lib/vhost-revenda';
import { sendEmail } from '@/lib/email-service';
import { nomeDoPerfil } from '@/lib/perfil-conta';
import { buildSimpleNotificationEmailHtml } from '@/lib/renewal-templates';

export const dynamic = 'force-dynamic';

/**
 * POST /api/vhost/mensagem — «Enviar mensagem» às contas escolhidas na lista (Silva, 18/11/2026).
 * { contas: string[], assunto, mensagem, prioridade?: 'Normal'|'Alta'|'Baixa', soEmail?: boolean }
 * Administrador: qualquer conta; revendedor: só as dos seus clientes. Aviso no sino do painel (a menos que seja só por e-mail) e e-mail.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return NextResponse.json({ erro: 'Sem permissão para enviar mensagens.' }, { status: auth.error.status });
  const sb = getDaSyncAdmin();
  if (!sb) return NextResponse.json({ erro: 'Registo do site indisponível.' }, { status: 503 });

  let c: { contas?: string[]; assunto?: string; mensagem?: string; prioridade?: string; soEmail?: boolean };
  try {
    c = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });
  }
  const assunto = String(c.assunto || '').trim();
  const mensagem = String(c.mensagem || '').trim();
  const contas = [...new Set((c.contas || []).map((u) => String(u).trim().toLowerCase()).filter(Boolean))];
  if (!assunto || !mensagem) return NextResponse.json({ erro: 'Escreva o assunto e a mensagem.' }, { status: 400 });
  if (!contas.length) return NextResponse.json({ erro: 'Escolha pelo menos uma conta.' }, { status: 400 });

  const { data: registo } = await sb.from('panel_users').select('username, auth_user_id').in('username', contas);
  let permitidos: Set<string> | null = null;
  if (auth.user.role !== 'admin') {
    const meus = await clientesDaRevenda(sb, auth.user.id);
    permitidos = new Set(meus.contas);
  }
  const alvos: { conta: string; userId: string }[] = [];
  const falhas: { conta: string; erro: string }[] = [];
  for (const u of contas) {
    if (permitidos && !permitidos.has(u)) {
      falhas.push({ conta: u, erro: 'conta fora do seu painel' });
      continue;
    }
    const id = (registo || []).find((r) => String(r.username).toLowerCase() === u)?.auth_user_id;
    if (!id) falhas.push({ conta: u, erro: 'esta conta não tem utilizador do site ligado' });
    else alvos.push({ conta: u, userId: String(id) });
  }

  const tipo = c.prioridade === 'Alta' ? 'warning' : 'info';
  const feitas: string[] = [];
  let emails = 0;
  for (const a of alvos) {
    try {
      if (!c.soEmail) {
        const { error } = await sb.from('notifications').insert({ user_id: a.userId, title: assunto, message: mensagem, type: tipo, category: 'general', email_sent: false });
        if (error) throw new Error(error.message);
      }
      const { data: u } = await sb.auth.admin.getUserById(a.userId);
      const email = u?.user?.email;
      if (email) {
        const clientName = await nomeDoPerfil(sb, a.userId, u?.user?.user_metadata?.full_name || email.split('@')[0] || 'Cliente');
        const html = mensagem.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        await sendEmail({ to: email, subject: assunto, html: buildSimpleNotificationEmailHtml({ clientName, title: assunto, message: mensagem, messageHtml: html, type: tipo }), category: 'transactional' });
        emails++;
      } else if (c.soEmail) throw new Error('a conta não tem e-mail');
      feitas.push(a.conta);
    } catch (e) {
      falhas.push({ conta: a.conta, erro: e instanceof Error ? e.message : 'erro ao enviar' });
    }
  }
  return NextResponse.json({ feitas, falhas, emails }, { status: feitas.length || !falhas.length ? 200 : 400 });
}
