// Alterações às contas do servidor (POST /api/vhost/acoes). Depois de uma alteração, o painel volta a ler o
// servidor, para mostrar o estado verdadeiro. Por agora o servidor só aceita contas de teste (nome "teste…").
import type { VH } from '../context';

export type AcaoServidor =
  | { acao: 'suspender' | 'reativar' | 'apagar'; contas: string[] }
  | { acao: 'pacote'; contas: string[]; pacote: string; forcar?: boolean }
  | { acao: 'senha'; contas: string[]; senha: string }
  | { acao: 'mover'; contas: string[]; para: string }
  | { acao: 'tipo'; contas: string[]; tipo: string }
  | {
      acao: 'pacote-gravar';
      gravar: {
        nome: string;
        /** nome antigo, ao mudar o nome de um pacote que já existe */
        de?: string;
        editar?: boolean;
        lim: Record<string, { v: string; unl: boolean; unit?: string }>;
        feats: Record<string, boolean>;
        rec?: Record<string, { v: string; unl: boolean; unit?: string }>;
        hestia?: Record<string, string>;
      };
    }
  | { acao: 'pacote-apagar'; pacotes: string[] }
  | { acao: 'criar'; criar: { user: string; nome?: string; email: string; senha: string; dominio?: string; pacote: string } };

/** Faz a alteração no servidor; devolve as contas alteradas (vazio se nada mudou) */
export async function noServidor(vh: VH, corpo: AcaoServidor, msgOk: (n: number) => string): Promise<string[]> {
  return (await noServidorDetalhe(vh, corpo, msgOk)).feitas;
}

/** Como noServidor, mas devolve também as contas que o servidor recusou e porquê */
export async function noServidorDetalhe(
  vh: VH,
  corpo: AcaoServidor,
  msgOk: (n: number) => string,
): Promise<{ feitas: string[]; falhas: { conta: string; erro: string }[] }> {
  vh.toast('A alterar no servidor…');
  try {
    const r = await fetch('/api/vhost/acoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const j = (await r.json().catch(() => ({}))) as { feitas?: string[]; falhas?: { conta: string; erro: string }[]; erro?: string };
    const feitas = j.feitas || [];
    const falhas = j.falhas || [];
    if (feitas.length) await vh.recarregar(true);
    if (falhas.length || !r.ok) {
      const det = falhas.map((f) => f.conta + ': ' + f.erro).join(' · ');
      vh.toast((feitas.length ? msgOk(feitas.length) + '. ' : '') + (j.erro || det || 'A alteração falhou'));
    } else vh.toast(msgOk(feitas.length));
    return { feitas, falhas };
  } catch {
    vh.toast('Sem ligação ao site. Nada foi alterado.');
    return { feitas: [], falhas: [] };
  }
}
