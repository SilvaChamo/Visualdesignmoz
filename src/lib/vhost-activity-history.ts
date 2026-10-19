import { getSupabaseAdmin } from '@/lib/supabase-admin';

const TABELA = 'vhost_activity_history';
const RETENCAO_MS = 7 * 24 * 60 * 60_000;
let ultimaLimpeza = 0;

export type EventoHistoricoVhost = {
  user_id: string;
  user_email: string;
  user_name: string;
  user_role: string;
  account_name: string;
  viewing_account: string;
  event_type: 'section' | 'click';
  section: string;
  action: string;
  duration_seconds: number | null;
};

export async function guardarEventoHistoricoVhost(evento: EventoHistoricoVhost): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 'A ligação administrativa à base de dados não está configurada.';

  const { error } = await supabase.from(TABELA).insert(evento);
  if (error) {
    console.error('[vhost/presenca] Não foi possível guardar a acção no histórico:', error.message);
    return 'Não foi possível guardar a acção no histórico.';
  }

  const agora = Date.now();
  if (agora - ultimaLimpeza > 60 * 60_000) {
    ultimaLimpeza = agora;
    const { error: erroLimpeza } = await supabase
      .from(TABELA)
      .delete()
      .lt('created_at', new Date(agora - RETENCAO_MS).toISOString());
    if (erroLimpeza) {
      ultimaLimpeza = 0;
      console.error('[vhost/presenca] Não foi possível eliminar histórico expirado:', erroLimpeza.message);
      return 'Não foi possível aplicar a retenção do histórico.';
    }
  }
  return null;
}
