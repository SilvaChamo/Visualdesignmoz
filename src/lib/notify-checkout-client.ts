import { sendEmail } from '@/lib/email-service';
import { buildEmailDocument, escapeHtml } from '@/lib/renewal-templates';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { nomeDoPerfil } from '@/lib/perfil-conta';
import { formatMt } from '@/lib/pricing-catalog';
import { referenciaPedido } from '@/lib/checkout-referencia';
import { MPESA_NUMBER, BANK_NAME, BANK_ACCOUNT, BANK_NIB } from '@/lib/quotation-payment-info';

const COMPANY_NAME = 'VisualDesign';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visualdesignmoz.com';
const NOREPLY_EMAIL = 'noreply@visualdesignmoz.com';

export type EventoCompra = 'criado' | 'comprovativo' | 'confirmado' | 'novo-comprovativo' | 'rejeitado' | 'expirado';

type Pedido = {
  id: string;
  total_mt: number;
  metodo_pagamento: string;
  items: Array<{ name?: string }>;
};

/** Texto de cada fase da compra (o mesmo no aviso do painel e no e-mail). Sem nomes de terceiros. */
function textos(evento: EventoCompra, pedido: Pedido, motivo?: string | null): { titulo: string; mensagem: string; tipo: 'info' | 'success' | 'error' | 'warning' } {
  const ref = referenciaPedido(pedido.id);
  const nomes = pedido.items.map((i) => i.name).filter(Boolean).join(', ') || 'o seu pedido';
  const valor = `${formatMt(Number(pedido.total_mt) || 0)} MT`;
  const dados =
    pedido.metodo_pagamento === 'mpesa'
      ? `Envie ${valor} para o M-Pesa ${MPESA_NUMBER}`
      : `Transfira ${valor} para ${BANK_NAME} — conta ${BANK_ACCOUNT}, NIB ${BANK_NIB}`;
  switch (evento) {
    case 'criado':
      return {
        titulo: 'Pedido registado — falta o pagamento',
        mensagem: `Registámos ${nomes}. ${dados}, indicando a referência ${ref}, e depois envie o comprovativo no painel (página Compras). O acesso às configurações do seu plano abre assim que a equipa confirmar o pagamento.`,
        tipo: 'info',
      };
    case 'comprovativo':
      return {
        titulo: 'Comprovativo recebido',
        mensagem: `Recebemos o comprovativo do pedido ${ref} (${nomes}). A nossa equipa vai confirmar o pagamento; avisamos assim que estiver feito.`,
        tipo: 'info',
      };
    case 'confirmado':
      return {
        titulo: 'Pagamento confirmado',
        mensagem: `O pagamento do pedido ${ref} (${nomes}) foi confirmado. O seu serviço está a ser activado e já pode aceder ao painel.`,
        tipo: 'success',
      };
    case 'novo-comprovativo':
      return {
        titulo: 'Precisamos de um novo comprovativo',
        mensagem: `Não conseguimos validar o comprovativo do pedido ${ref} (${nomes}).${motivo ? ` Motivo: ${motivo}.` : ''} Envie outro no painel (página Compras).`,
        tipo: 'warning',
      };
    case 'rejeitado':
      return {
        titulo: 'Pedido não aprovado',
        mensagem: `O pedido ${ref} (${nomes}) não foi aprovado.${motivo ? ` Motivo: ${motivo}.` : ''} Se tiver dúvidas, contacte o suporte.`,
        tipo: 'error',
      };
    case 'expirado':
      return {
        titulo: 'Pedido expirado',
        mensagem: `O pedido ${ref} (${nomes}) expirou por falta de pagamento. Se ainda quiser o serviço, faça um pedido novo.`,
        tipo: 'warning',
      };
  }
}

/**
 * Avisa o cliente de cada fase de uma compra do carrinho paga por M-Pesa/Transferência: aviso no painel e e-mail.
 * Nunca lança erro — um aviso falhado não pode estragar a confirmação nem o envio do comprovativo.
 */
export async function avisarClienteCompra(params: {
  /** null: pedido de quem ainda não tem conta (o login só nasce na aprovação) — vai só o e-mail, para `para` */
  userId: string | null;
  evento: EventoCompra;
  pedido: Pedido;
  motivo?: string | null;
  para?: { email: string; nome: string } | null;
  /** o login foi criado agora, na aprovação: o e-mail diz como entrar */
  contaCriada?: boolean;
}): Promise<void> {
  const { userId, evento, pedido, motivo } = params;
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const base = textos(evento, pedido, motivo);
  const { titulo, tipo } = base;
  let mensagem = base.mensagem;
  if (!userId && evento === 'comprovativo') {
    mensagem = `${mensagem} Quando o pagamento for confirmado, criamos a sua conta e enviamos-lhe outro e-mail.`;
  }
  if (params.contaCriada && params.para?.email) {
    mensagem = `${mensagem} A sua conta foi criada: entre com o e-mail ${params.para.email} e a palavra-passe que escolheu na compra.`;
  }

  if (!userId) {
    if (!params.para?.email) return;
    try {
      await sendEmail({
        to: params.para.email,
        subject: titulo,
        html: buildEmailDocument({
          companyName: COMPANY_NAME,
          clientName: params.para.nome,
          title: titulo,
          bodyHtml: `<p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.5; font-family: 'Exo 2', sans-serif;">${escapeHtml(mensagem)}</p>`,
        }),
        from: NOREPLY_EMAIL,
        category: 'transactional',
      });
    } catch (err) {
      console.error('[notify-checkout-client] falha ao enviar o e-mail:', err);
    }
    return;
  }

  try {
    await admin.from('notifications').insert({
      user_id: userId,
      title: titulo,
      message: mensagem,
      type: tipo,
      category: 'system',
      link: `${SITE_URL}/vhost:2026`,
      link_text: 'Abrir o painel',
    });
  } catch (err) {
    console.error('[notify-checkout-client] falha ao criar o aviso no painel:', err);
  }

  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    const para = data?.user?.email;
    if (!para) return;
    const nome = await nomeDoPerfil(admin, userId, String(data.user?.user_metadata?.nome || para.split('@')[0]));
    const corpo = `<p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.5; font-family: 'Exo 2', sans-serif;">${escapeHtml(mensagem)}</p>
      <p style="margin: 20px 0 0 0;"><a href="${SITE_URL}/vhost:2026" style="display: inline-block; padding: 8px 14px; background: #dc2626; color: #ffffff; text-decoration: none; border-radius: 2px; font-size: 12px; font-weight: bold; font-family: 'Exo 2', sans-serif;">Abrir o painel &rarr;</a></p>`;
    await sendEmail({
      to: para,
      subject: titulo,
      html: buildEmailDocument({ companyName: COMPANY_NAME, clientName: nome, title: titulo, bodyHtml: corpo }),
      from: NOREPLY_EMAIL,
      category: 'transactional',
    });
  } catch (err) {
    console.error('[notify-checkout-client] falha ao enviar o e-mail:', err);
  }
}
