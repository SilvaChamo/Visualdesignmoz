import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email-service';
import { buildSimpleNotificationEmailHtml } from '@/lib/renewal-templates';
import { dominioProtegido, RECUPERACAO_DIAS } from '@/lib/overdue-hosting-suspend';

/**
 * Avisos do período de recuperação (a regra e os 30 dias estão em overdue-hosting-suspend.ts, RECUPERACAO_DIAS).
 * O cliente é avisado no dia da suspensão, a meio e nos últimos dias.
 */

/** Marcos dos avisos, em dias depois do fim do prazo (cada marco avisa uma só vez). */
const MARCOS = [
  { id: 'inicio', de: 1, ate: 14 },
  { id: 'meio', de: 15, ate: 26 },
  { id: 'fim', de: 27, ate: RECUPERACAO_DIAS },
] as const;

const AVISOS_MAX_POR_CORRIDA = 30;
const MS_DIA = 86_400_000;

type Linha = {
  id: string;
  user_id: string | null;
  domain_name: string | null;
  server: string | null;
  package_name?: string | null;
  expiration_date: string | null;
};

export type ResultadoRecuperacao = {
  avisados: number;
  errors: string[];
  /** só na simulação: a quem se avisaria */
  planeados?: { domain: string; marco: string; diasRestantes: number }[];
};

function diaIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const dataPt = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-PT', { timeZone: 'UTC' });

/** Texto do aviso (curto e claro): o que aconteceu, até quando pode recuperar e o que acontece depois. */
function textoAviso(marco: (typeof MARCOS)[number]['id'], servico: string, dominio: string, expirou: string, limite: string, diasRestantes: number) {
  const dias = `${diasRestantes} dia${diasRestantes === 1 ? '' : 's'}`;
  const fecho = `Depois de ${dataPt(limite)} o serviço pode ser removido do servidor. Renove antes dessa data e tudo volta a funcionar como estava.`;
  if (marco === 'inicio') {
    return {
      title: `O seu serviço foi suspenso — tem ${dias} para o recuperar`,
      message:
        `O ${servico} ${dominio} expirou a ${dataPt(expirou)} e ficou suspenso. Não perdeu nada: os ficheiros e as caixas de e-mail estão guardados.\n\n` +
        `Tem até ${dataPt(limite)} para renovar e reactivá-lo. ${fecho}`,
    };
  }
  if (marco === 'meio') {
    return {
      title: `Faltam ${dias} para recuperar ${dominio}`,
      message: `O ${servico} ${dominio} continua suspenso desde ${dataPt(expirou)}. O período de recuperação termina a ${dataPt(limite)}.\n\n${fecho}`,
    };
  }
  return {
    title: `Últimos ${dias} para recuperar ${dominio}`,
    message: `O ${servico} ${dominio} continua suspenso e o período de recuperação termina a ${dataPt(limite)}.\n\n${fecho}`,
  };
}

/**
 * Avisa os clientes cujo serviço foi suspenso por falta de renovação e ainda está dentro do período de recuperação.
 * Cada marco avisa uma só vez (a marca vai no link da notificação, como nos avisos de renovação). Com `simular`, só diz o que faria.
 */
export async function avisarPeriodoDeRecuperacao(
  admin: SupabaseClient,
  opcoes: { simular?: boolean } = {},
): Promise<ResultadoRecuperacao> {
  const result: ResultadoRecuperacao = { avisados: 0, errors: [] };
  if (opcoes.simular) result.planeados = [];

  const hoje = new Date();
  const hojeIso = diaIso(hoje);
  const maisAntigo = diaIso(new Date(hoje.getTime() - RECUPERACAO_DIAS * MS_DIA));

  const { data: rows, error } = await admin
    .from('hosting_renewals')
    .select('id, user_id, domain_name, server, package_name, expiration_date')
    .eq('status', 'expired')
    .lt('expiration_date', hojeIso)
    .gte('expiration_date', maisAntigo);
  if (error) {
    result.errors.push(`Recuperação: ${error.message}`);
    return result;
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://visualdesignmoz.com';
  for (const row of (rows || []) as Linha[]) {
    const dominio = String(row.domain_name || '').trim().toLowerCase();
    const expirou = String(row.expiration_date || '').slice(0, 10);
    if (!dominio || !expirou || !row.user_id || dominioProtegido(dominio)) continue;

    const diasDepois = Math.floor((Date.parse(hojeIso) - Date.parse(expirou)) / MS_DIA);
    const marco = MARCOS.find((m) => diasDepois >= m.de && diasDepois <= m.ate);
    if (!marco) continue;

    const limite = diaIso(new Date(Date.parse(expirou) + RECUPERACAO_DIAS * MS_DIA));
    const diasRestantes = Math.max(1, RECUPERACAO_DIAS - diasDepois);
    if (opcoes.simular) {
      result.planeados!.push({ domain: dominio, marco: marco.id, diasRestantes });
      continue;
    }
    if (result.avisados >= AVISOS_MAX_POR_CORRIDA) break;

    try {
      const marca = `rid=recuperacao:${row.id}:${marco.id}`;
      const { data: jaAvisado } = await admin
        .from('notifications')
        .select('id')
        .eq('user_id', row.user_id)
        .ilike('link', `%${marca}%`)
        .limit(1);
      if (jaAvisado && jaAvisado.length > 0) continue;

      const { data: { user } } = await admin.auth.admin.getUserById(row.user_id);
      if (!user) {
        result.errors.push(`Recuperação: utilizador não encontrado (${dominio})`);
        continue;
      }
      const nome = (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || 'Cliente';
      const servico = row.server === 'Mail' ? 'plano de e-mail' : 'alojamento';
      const { title, message } = textoAviso(marco.id, servico, dominio, expirou, limite, diasRestantes);
      const ligacao = `${site}/renovacao/iniciar/hosting/${row.id}`;

      // a notificação primeiro: é ela que serve de marca, para um erro no e-mail não repetir o aviso na corrida seguinte
      const { data: notificacao, error: erroNotif } = await admin
        .from('notifications')
        .insert({
          user_id: row.user_id,
          title,
          message,
          type: 'warning',
          category: 'payment',
          link: `${ligacao}?${marca}`,
          link_text: 'Renovar agora',
          email_sent: false,
        })
        .select()
        .single();
      if (erroNotif || !notificacao) {
        result.errors.push(`Recuperação: notificação falhou (${dominio}): ${erroNotif?.message || 'sem resposta'}`);
        continue;
      }

      if (user.email) {
        try {
          await sendEmail({
            to: user.email,
            subject: title,
            html: buildSimpleNotificationEmailHtml({ clientName: nome, title, message, link: ligacao, linkText: 'Renovar agora', type: 'warning' }),
            category: 'transactional',
          });
          await admin.from('notifications').update({ email_sent: true }).eq('id', notificacao.id);
        } catch (e) {
          result.errors.push(`Recuperação: e-mail não enviado (${dominio}): ${e instanceof Error ? e.message : 'erro'}`);
        }
      }
      result.avisados += 1;
    } catch (e) {
      result.errors.push(`Recuperação ${dominio}: ${e instanceof Error ? e.message : 'erro'}`);
    }
  }
  return result;
}
