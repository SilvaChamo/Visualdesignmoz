'use client';

// Avisos no menu (Silva, 24/10/2026): quando entra uma encomenda, é cancelada ou muda de estado, o item "Encomendas" do menu mostra um balão
// com o número de novidades (e um aviso curto no ecrã). As novidades são as que ainda não foram vistas: ao abrir a página das encomendas
// ficam vistas. O cliente vê as suas encomendas (e mensagens por ler); o administrador vê as recebidas e, em "Contabilidade", o que está
// por confirmar. Sem nada guardado neste navegador, a primeira leitura só regista o estado actual (não avisa do que já lá estava).
import { useEffect, useRef, useState } from 'react';

export interface AvisoMenu {
  n: number;
  titulo: string;
}

const CHAVE = 'vh-enc-vistos';
const INTERVALO_MS = 30000;

type Lote = { id: string; status: string };

const ler = (): Record<string, string> | null => {
  try {
    const v = localStorage.getItem(CHAVE);
    return v ? (JSON.parse(v) as Record<string, string>) : null;
  } catch {
    return null;
  }
};
const guardar = (v: Record<string, string>) => {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(v));
  } catch {
    /* sem armazenamento: avisa sempre */
  }
};

const frase = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

/** Resume as novidades: "2 novas, 1 cancelada…" */
function resumo(novos: Lote[], msgs: number): string {
  const c = { pending: 0, payment_selected: 0, cancelled: 0, rejected: 0, outras: 0 };
  for (const l of novos) {
    if (l.status === 'pending') c.pending++;
    else if (l.status === 'payment_selected') c.payment_selected++;
    else if (l.status === 'cancelled') c.cancelled++;
    else if (l.status === 'rejected') c.rejected++;
    else c.outras++;
  }
  const partes: string[] = [];
  if (c.pending) partes.push(frase(c.pending, 'encomenda nova', 'encomendas novas'));
  if (c.payment_selected) partes.push(frase(c.payment_selected, 'pagamento por confirmar', 'pagamentos por confirmar'));
  if (c.cancelled) partes.push(frase(c.cancelled, 'encomenda cancelada', 'encomendas canceladas'));
  if (c.rejected) partes.push(frase(c.rejected, 'encomenda rejeitada', 'encomendas rejeitadas'));
  if (c.outras) partes.push(frase(c.outras, 'encomenda actualizada', 'encomendas actualizadas'));
  if (msgs) partes.push(frase(msgs, 'mensagem por ler', 'mensagens por ler'));
  return partes.join(', ');
}

/**
 * @param ativo       só lê com a sessão aberta (e fora de "entrar como" outra conta)
 * @param admin       o administrador vê as encomendas recebidas; os outros, as suas
 * @param emEncomendas a página das encomendas está aberta: o que há agora fica visto
 * @param avisar      aviso curto no ecrã quando chega uma novidade
 */
export function useAvisosEncomendas(ativo: boolean, admin: boolean, emEncomendas: boolean, avisar: (msg: string) => void): Record<string, AvisoMenu> {
  const [avisos, setAvisos] = useState<Record<string, AvisoMenu>>({});
  const atual = useRef<{ lotes: Lote[]; msgs: number }>({ lotes: [], msgs: 0 });
  const emEnc = useRef(emEncomendas);
  const avisarRef = useRef(avisar);
  avisarRef.current = avisar;
  emEnc.current = emEncomendas;

  useEffect(() => {
    if (!ativo) {
      setAvisos({});
      return;
    }
    let vivo = true;

    const calcular = (anunciar: boolean) => {
      const { lotes, msgs } = atual.current;
      let vistos = ler();
      const mapa = Object.fromEntries(lotes.map((l) => [l.id, l.status]));
      if (!vistos) {
        guardar(mapa);
        vistos = mapa;
      }
      if (emEnc.current) {
        guardar(mapa);
        vistos = mapa;
      }
      const novos = lotes.filter((l) => vistos![l.id] !== l.status);
      const n = novos.length + msgs;
      setAvisos((prev) => {
        const proximo = { ...prev };
        if (n > 0) proximo.encomendas = { n, titulo: resumo(novos, msgs) };
        else delete proximo.encomendas;
        return proximo;
      });
      if (anunciar && n > 0 && !emEnc.current) avisarRef.current(resumo(novos, msgs));
    };

    let anunciadoAntes = '';
    const ler_ = async () => {
      try {
        if (admin) {
          const [a, b] = await Promise.all([
            fetch('/api/admin/cotacoes/pending-count', { headers: { 'x-vh-fundo': '1' } }).then((r) => r.json()).catch(() => null),
            fetch('/api/admin/contabilidade-pendentes', { headers: { 'x-vh-fundo': '1' } }).then((r) => r.json()).catch(() => null),
          ]);
          if (!vivo) return;
          if (a?.success) atual.current = { lotes: (a.lotes as Lote[]) || [], msgs: 0 };
          const pend = b?.success ? Number(b.stats?.pendentes) || 0 : 0;
          setAvisos((prev) => {
            const proximo = { ...prev };
            if (pend > 0) proximo.contabilidade = { n: pend, titulo: frase(pend, 'item por confirmar', 'itens por confirmar') };
            else delete proximo.contabilidade;
            return proximo;
          });
        } else {
          const r = await fetch('/api/cotacoes', { headers: { 'x-vh-fundo': '1' } }).then((x) => x.json()).catch(() => null);
          if (!vivo || !r?.success) return;
          const porLote = new Map<string, string>();
          for (const q of (r.quotations as Array<{ batch_id: string; status: string }>) || []) if (!porLote.has(q.batch_id)) porLote.set(q.batch_id, q.status);
          atual.current = { lotes: [...porLote].map(([id, status]) => ({ id, status })), msgs: Number(r.unreadTotal) || 0 };
        }
        if (!vivo) return;
        const antes = JSON.stringify(atual.current);
        calcular(antes !== anunciadoAntes && anunciadoAntes !== '');
        anunciadoAntes = antes;
      } catch {
        /* sem rede: tenta na próxima */
      }
    };

    ler_();
    const t = setInterval(ler_, INTERVALO_MS);
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') ler_();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [ativo, admin]);

  // ao abrir a página das encomendas, o que há agora fica visto
  useEffect(() => {
    if (!ativo || !emEncomendas) return;
    const mapa = Object.fromEntries(atual.current.lotes.map((l) => [l.id, l.status]));
    guardar(mapa);
    setAvisos((prev) => {
      if (!prev.encomendas) return prev;
      const { encomendas: _x, ...resto } = prev;
      return resto;
    });
  }, [ativo, emEncomendas]);

  return avisos;
}
