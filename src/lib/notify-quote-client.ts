import { sendEmail } from '@/lib/email-service';
import { buildEmailDocument, escapeHtml } from '@/lib/renewal-templates';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { nomeDoPerfil } from '@/lib/perfil-conta';
import { formatMt } from '@/lib/pricing-catalog';

const COMPANY_NAME = 'VisualDesign';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visualdesignmoz.com';
// noreply propositado — estas notificações nunca esperam resposta por email,
// só servem para levar o cliente de volta ao painel (conversa/estado ficam lá).
const NOREPLY_EMAIL = 'noreply@visualdesignmoz.com';

const APPROVAL_NOTICE =
  'Brevemente irá receber layouts de design para aprovação, de forma a avançarmos com a produção. ' +
  'É importante responder a esses pedidos de aprovação o mais rápido possível — atrasos nas aprovações ' +
  'podem comprometer o prazo de entrega combinado.';

function buildClientEmailHtml(params: {
  clientName: string;
  title: string;
  message: string;
  ctaLink?: string;
  ctaText?: string;
}) {
  const { clientName, title, message, ctaLink, ctaText } = params;

  const body = `
    <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.5; white-space: pre-line; font-family: 'Exo 2', sans-serif;">${escapeHtml(message)}</p>
    ${ctaLink ? `<p style="margin: 20px 0 0 0;"><a href="${ctaLink}" style="display: inline-block; padding: 8px 14px; background: #dc2626; color: #ffffff; text-decoration: none; border-radius: 2px; font-size: 12px; font-weight: bold; font-family: 'Exo 2', sans-serif;">${escapeHtml(ctaText || 'Aceder à plataforma')} &rarr;</a></p>` : ''}
  `;

  return buildEmailDocument({ companyName: COMPANY_NAME, clientName, title, bodyHtml: body });
}

/**
 * Avisa o cliente (email) quando a equipa aprova ou rejeita a sua encomenda
 * (quotation_requests). Isolado em try/catch — uma falha de email nunca deve
 * impedir a actualização de estado no dashboard.
 */
export async function notifyQuoteClientStatusChange(params: {
  to: string;
  clientName: string;
  produto: string;
  status: 'approved' | 'rejected' | 'delivered' | 'done';
  rejectionReason?: string | null;
  /** Conta do cliente — o nome do cumprimento vem do perfil dela. */
  userId?: string | null;
}) {
  const { to, produto, status, rejectionReason, userId } = params;
  const clientName = await nomeDoPerfil(getSupabaseAdmin(), userId, params.clientName);

  const title = {
    approved: 'A sua encomenda foi aprovada',
    rejected: 'Actualização sobre a sua encomenda',
    delivered: 'A sua encomenda está concluída',
    done: 'A sua encomenda foi entregue',
  }[status];

  const message = {
    approved: `A sua encomenda "${produto}" foi aprovada e a produção vai avançar.\n\n${APPROVAL_NOTICE}`,
    rejected: `A sua encomenda "${produto}" não foi aprovada neste momento.${
      rejectionReason ? `\n\nMotivo: ${rejectionReason}` : ''
    }\n\nEntre em contacto connosco se tiver dúvidas.`,
    delivered: `A sua encomenda "${produto}" está concluída e pronta para levantamento. Falta apenas confirmar o pagamento do remanescente para avançarmos com a entrega.`,
    done: `A sua encomenda "${produto}" foi entregue com sucesso. Obrigado por escolher a VisualDesign!`,
  }[status];

  try {
    await sendEmail({
      to,
      subject: title,
      html: buildClientEmailHtml({ clientName, title, message }),
      from: NOREPLY_EMAIL,
      category: 'transactional',
    });
  } catch (err) {
    console.error('[notify-quote-client] falha ao enviar email ao cliente:', err);
  }
}

/**
 * Avisa o cliente (email) quando a equipa responde a uma mensagem sobre a
 * sua encomenda (quotation_messages). Isolado em try/catch, mesmo padrão de
 * notifyQuoteClientStatusChange.
 */
export async function notifyQuoteClientNewMessage(params: {
  to: string;
  clientName: string;
  produto: string;
  quotationId: string;
  userId?: string | null;
}) {
  const { to, produto, quotationId, userId } = params;
  const clientName = await nomeDoPerfil(getSupabaseAdmin(), userId, params.clientName);
  const title = 'Nova mensagem sobre a sua encomenda';
  const body = `A equipa respondeu sobre a sua encomenda "${produto}". Aceda à plataforma para ver a conversa completa e responder.`;
  const ctaLink = `${SITE_URL}/encomendas?section=mensagens&quotationId=${quotationId}`;

  try {
    await sendEmail({
      to,
      subject: title,
      html: buildClientEmailHtml({ clientName, title, message: body, ctaLink, ctaText: 'Ver conversa' }),
      from: NOREPLY_EMAIL,
      category: 'transactional',
    });
  } catch (err) {
    console.error('[notify-quote-client] falha ao enviar email de nova mensagem:', err);
  }
}

/**
 * Avisa o cliente (email) quando a equipa define o valor de um item que
 * tinha sido submetido como "Sob Consulta" (sem preço fixo no catálogo, ou
 * pedido personalizado). O painel do cliente já mostra o valor assim que a
 * linha é actualizada — este email só avisa que há resposta à espera.
 */
export async function notifyQuoteClientPriceDefined(params: {
  to: string;
  clientName: string;
  produto: string;
  valorMt: number;
  userId?: string | null;
}) {
  const { to, produto, valorMt, userId } = params;
  const clientName = await nomeDoPerfil(getSupabaseAdmin(), userId, params.clientName);
  const title = 'Valor definido para o seu pedido sob consulta';
  const message = `A equipa definiu o valor para o pedido "${produto}": ${formatMt(valorMt)} MT.\n\nAceda ao painel para ver os detalhes e avançar com o pagamento.`;

  try {
    await sendEmail({
      to,
      subject: title,
      html: buildClientEmailHtml({ clientName, title, message }),
      from: NOREPLY_EMAIL,
      category: 'transactional',
    });
  } catch (err) {
    console.error('[notify-quote-client] falha ao enviar email de valor definido:', err);
  }
}

/**
 * Avisa o cliente (email) quando a equipa envia um novo layout de design
 * para aprovação (quotation_layouts). Assunto inclui a descrição e a fase,
 * para o cliente identificar de imediato do que se trata.
 */
export async function notifyQuoteClientNewLayout(params: {
  to: string;
  clientName: string;
  produto: string;
  descricao: string;
  fase: number;
  userId?: string | null;
}) {
  const { to, produto, descricao, fase, userId } = params;
  const clientName = await nomeDoPerfil(getSupabaseAdmin(), userId, params.clientName);
  const title = `Novo layout enviado: ${descricao} — Fase ${fase}`;
  const body = `A equipa enviou um novo layout para a sua encomenda "${produto}":\n\nFase ${fase} — ${descricao}\n\nEntre no painel para ver e descarregar.`;

  try {
    await sendEmail({
      to,
      subject: title,
      html: buildClientEmailHtml({ clientName, title, message: body }),
      from: NOREPLY_EMAIL,
      category: 'transactional',
    });
  } catch (err) {
    console.error('[notify-quote-client] falha ao enviar email de novo layout:', err);
  }
}
