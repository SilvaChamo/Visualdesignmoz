import { lerServidor } from '@/lib/vhost-servidor';
import { lerRegisto, montarDados } from '@/lib/vhost-dados';

export const EMAIL_RE = /^[a-z0-9]([a-z0-9._+-]{0,62}[a-z0-9])?@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export type Sessao = { userId: string; email: string; role: string };

/** A caixa tem de existir no servidor, numa conta que a sessão vê. O resultado guarda-se 10 minutos por sessão e caixa
 *  (cada clique do VhostMail faz um pedido; o registo do painel não precisa de ser lido de cada vez) */
const acessos = new Map<string, number>();
const recusadas = new Map<string, number>();
export async function podeVer(s: Sessao, end: string): Promise<boolean> {
  if (!EMAIL_RE.test(end)) return false;
  const chave = s.userId + '|' + end;
  if ((acessos.get(chave) || 0) > Date.now()) return true;
  const [utilizador, dominio] = end.toLowerCase().split('@');
  const procura = async (forcar: boolean) => {
    const srv = await lerServidor(forcar);
    const dados = montarDados(srv, await lerRegisto(), s);
    return Object.keys(dados.contas).some((conta) => !!srv.mailAcc[conta]?.[dominio]?.[utilizador]);
  };
  let sim = await procura(false);
  // Uma caixa criada há pouco ainda não está na leitura guardada do servidor (até 1 hora): antes de recusar, lê o servidor na hora
  // (no máximo uma vez por minuto para cada sessão e caixa), para o cliente não ficar à porta da caixa que acabou de ter.
  if (!sim && (recusadas.get(chave) || 0) < Date.now()) {
    recusadas.set(chave, Date.now() + 60_000);
    if (recusadas.size > 500) for (const [k, ate] of recusadas) if (ate < Date.now()) recusadas.delete(k);
    sim = await procura(true);
  }
  if (sim) {
    acessos.set(chave, Date.now() + 10 * 60_000);
    if (acessos.size > 500) for (const [k, ate] of acessos) if (ate < Date.now()) acessos.delete(k);
  }
  return sim;
}

