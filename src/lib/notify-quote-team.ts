import { createClient as createAdminClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email-service';
import { buildEmailDocument, escapeHtml as esc } from '@/lib/renewal-templates';

const TEAM_EMAIL = 'geral@visualdesignmoz.com';
const COMPANY_NAME = 'VisualDesign';

const FONT = "'Exo 2', sans-serif";

/** Dados de uma nova cotação/encomenda — desenham o corpo do email (lista de itens, entrega, contacto). */
export type QuoteTeamOrder = {
  cliente: string;
  numero: string;
  itens: { nome: string; categoria: string; quantidade: number; valor: string }[];
  /** Data limite pretendida, já formatada (ex.: "02 de Novembro de 2026"). */
  entrega: string;
  /** Frase sobre o pagamento do adiantamento, quando o cliente já escolheu o método. */
  pagamento?: string;
  responsavel: string;
  telefone: string;
  email: string;
};

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** "2026-11-02" -> "02 de Novembro de 2026" (sem passar por Date, para o fuso não mudar o dia). */
export function formatDataExtenso(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mes = MESES[Number(m[2]) - 1];
  return mes ? `${m[3]} de ${mes} de ${m[1]}` : iso;
}

function buildOrderBody(order: QuoteTeamOrder) {
  const total = order.itens.length;
  // Duas colunas: o item e o valor. O valor alinha à esquerda da sua coluna, por
  // isso os hífens ficam todos na mesma linha vertical, seja qual for o valor.
  const linhas = order.itens
    .map((item, i) => {
      const fim = i < total - 1 ? ';' : '';
      return `<tr>
        <td valign="top" style="padding: 1px 0; font-size: 12px; line-height: 1.5; color: #4b5563; font-family: ${FONT};">${i + 1}. &quot;${esc(item.nome)}&quot; (${esc(item.categoria)}) x${item.quantidade}</td>
        <td valign="top" align="left" style="padding: 1px 0 1px 16px; font-size: 12px; line-height: 1.5; color: #4b5563; white-space: nowrap; text-align: left; font-family: ${FONT};">— ${esc(item.valor)}${fim}</td>
      </tr>`;
    })
    .join('');

  return `
    <p style="margin: 0 0 12px 0; color: #4b5563; font-size: 14px; line-height: 1.5; font-family: ${FONT};">O cliente: ${esc(order.cliente)} pediu uma cotação nº: ${esc(order.numero)} com os seguintes itens:</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 16px 0; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 2px;">
      <tr><td style="padding: 10px 14px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">${linhas}</table>
      </td></tr>
    </table>
    <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.5; font-family: ${FONT};">Entrega pretendida até ${esc(order.entrega)}.${order.pagamento ? `<br>${esc(order.pagamento)}` : ''}</p>
    <p style="margin: 16px 0 0 0; color: #4b5563; font-size: 14px; line-height: 1.5; font-family: ${FONT};">Responsável: ${esc(order.responsavel)}<br>Contacto: ${esc(order.telefone)}<br>Email: ${esc(order.email)}</p>
  `;
}

function buildTeamEmailHtml(title: string, message: string, link?: string, order?: QuoteTeamOrder) {
  const corpo = order
    ? buildOrderBody(order)
    : `<p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.5; white-space: pre-line; font-family: ${FONT};">${esc(message)}</p>`;

  const botao = link
    ? `<p style="margin: 20px 0 0 0;"><a href="${esc(link)}" style="display: inline-block; padding: 8px 14px; background: #dc2626; color: #ffffff; text-decoration: none; border-radius: 2px; font-size: 12px; font-weight: bold; font-family: ${FONT};">Ver no painel &rarr;</a></p>`
    : '';

  return buildEmailDocument({ companyName: COMPANY_NAME, clientName: 'Admin', title, bodyHtml: corpo + botao });
}

/**
 * Avisa a equipa (email + notificação interna no dashboard) sobre eventos do
 * fluxo de cotações (/precos -> /cotacao). Isolado em try/catch — uma falha
 * de email/notificação nunca deve impedir o cliente de completar o pedido.
 * Com `order`, o email mostra a cotação desenhada (itens, entrega, contacto);
 * a notificação interna continua a usar o texto simples de `message`.
 */
export async function notifyQuoteTeam(params: { title: string; message: string; link?: string; order?: QuoteTeamOrder }) {
  const { title, message, link, order } = params;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  try {
    if (serviceKey && supabaseUrl) {
      const admin = createAdminClient(supabaseUrl, serviceKey);
      // notifications.user_id aponta para auth.users(id): o identificador do administrador é profiles.user_id, nunca profiles.id
      // (que é uma chave própria da tabela e fazia o aviso falhar sempre, em silêncio). Avisa todos os administradores.
      const { data: admins } = await admin
        .from('profiles')
        .select('user_id')
        .eq('role', 'admin')
        .not('user_id', 'is', null)
        .limit(10);

      const destinos = Array.from(new Set((admins || []).map((a) => a.user_id as string).filter(Boolean)));
      if (destinos.length) {
        const { error: avisoErro } = await admin.from('notifications').insert(
          destinos.map((userId) => ({
            user_id: userId,
            title,
            message,
            type: 'info',
            category: 'general',
            link,
            link_text: link ? 'Ver no painel' : undefined,
          })),
        );
        if (avisoErro) console.error('[notify-quote-team] aviso interno recusado:', avisoErro.message);
      }
    }
  } catch (err) {
    console.error('[notify-quote-team] falha ao criar notificação interna:', err);
  }

  try {
    await sendEmail({
      to: TEAM_EMAIL,
      subject: title,
      html: buildTeamEmailHtml(title, message, link, order),
      category: 'transactional',
    });
  } catch (err) {
    console.error('[notify-quote-team] falha ao enviar email à equipa:', err);
  }
}
