'use client';

// Transferir domínio — o mesmo processo do painel antigo (src/app/dashboard/DomainTransferSection.tsx), no modelo do
// VisualHost (pedido do Silva, 13/10/2026: o DirectAdmin não tinha; "copiar do painel da VisualDesign"). Domínio +
// código EPP → validar → preço → carrinho e pagamento; depois do pagamento o pedido segue sozinho para a Dynadot
// (checkout-fulfillment) e o cron domain-transfer-check acompanha-o. Usa as mesmas rotas: /api/domain-check,
// /api/domain-tld-prices, /api/domain-transfer, /api/domain-transfer/status e /api/domain-transfer/dns-snapshot.
import { useEffect, useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { MZN_TO_USD_RATE } from '@/lib/currency';
import { useVH } from '../context';
import { esquecerMemoria, useGet } from '../carga';
import { DataTable } from './componentes';

type Pedido = {
  id: string;
  domain_name: string;
  status: 'pending' | 'submitted' | 'waiting' | 'locked' | 'completed' | 'rejected' | 'failed';
  error_message?: string | null;
  created_at: string;
  order?: { orderId: string; costMt: number; paidMt: number; metodoPagamento: string; status: 'pending' | 'paid' | 'failed' } | null;
};

const ROTA = '/api/domain-transfer';
const METODO: Record<string, string> = { mpesa: 'M-Pesa', emola: 'e-Mola', transferencia: 'Transferência', stripe: 'Cartão' };
/** estado da transferência → [texto, cor da etiqueta, explicação no popup] */
const ESTADO: Record<Pedido['status'], [string, string, string?]> = {
  pending: ['A processar pagamento', 'off'],
  submitted: ['Em curso', 'w', 'Processo a decorrer — pode demorar alguns dias. Vai receber um aviso assim que terminar.'],
  waiting: ['Em curso', 'w', 'Processo a decorrer — pode demorar alguns dias. Vai receber um aviso assim que terminar.'],
  locked: ['Bloqueada — precisa da sua ação', 'bad', 'O domínio está "bloqueado" (locked) no registador antigo, o que impede a transferência de avançar. Entre na conta desse registador (ou peça ao suporte dele) e desative o bloqueio de transferência ("unlock"). Assim que desbloquear, o processo continua sozinho.'],
  completed: ['Concluída', 'ok'],
  rejected: ['Rejeitada pelo registador anterior', 'bad'],
  failed: ['Falhou ao submeter — contacte o suporte', 'bad'],
};
const PAGAMENTO: Record<string, [string, string]> = { pending: ['A aguardar pagamento', 'w'], paid: ['Pago', 'ok'], failed: ['Pagamento rejeitado', 'bad'] };
const emCurso = (p: Pedido) => p.status === 'submitted' || p.status === 'waiting' || p.status === 'locked';
/** a ICANN dá ao registador anterior até 5–7 dias para responder; usamos 7 (o pior caso) para não prometer mais rápido */
const DIAS = 7;
const PASSOS = [
  'Pede-se a transferência com o código de autorização (EPP) do registador atual.',
  'O registador anterior recebe o pedido e tem de aprovar — ou passar 5 a 7 dias sem responder, o que conta como aprovação silenciosa.',
  'Assim que aprovado, o domínio passa a ser gerido por nós e fica logo ativo na sua conta.',
];

function useContagem(fimMs: number) {
  const calc = () => Math.max(0, fimMs - Date.now());
  const [falta, setFalta] = useState(calc);
  useEffect(() => {
    setFalta(calc());
    const iv = setInterval(() => setFalta(calc()), 1000);
    return () => clearInterval(iv);
  }, [fimMs]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = Math.floor(falta / 864e5);
  const h = Math.floor((falta % 864e5) / 36e5);
  const m = Math.floor((falta % 36e5) / 6e4);
  const s = Math.floor((falta % 6e4) / 1e3);
  return { d, h, m, s, fim: falta === 0 };
}

/** Cartão de uma transferência em curso: contagem até ao prazo de 7 dias e barra de progresso (é só uma estimativa —
 *  quem confirma o fim é a verificação automática à Dynadot) */
function EmCurso({ p, inicio, onVer }: { p: Pedido; inicio: string; onVer: () => void }) {
  const { t } = useVH();
  const ini = new Date(inicio).getTime();
  const fimMs = ini + DIAS * 864e5;
  const c = useContagem(fimMs);
  const pct = Math.min(100, Math.max(4, Math.round(((Date.now() - ini) / (DIAS * 864e5)) * 100)));
  const [txt, cor] = ESTADO[p.status];
  return (
    <div className="tr-curso">
      <div className="tr-curso-topo">
        <b>{p.domain_name}</b>
        <span className={'tag ' + cor}>{t(txt)}</span>
      </div>
      {c.fim ? (
        <p className="tr-curso-nota">{t('A demorar mais do que o previsto — ainda em curso')}</p>
      ) : (
        <div className="tr-contagem">
          {([
            [c.d, 'dias'],
            [c.h, 'horas'],
            [c.m, 'min'],
            [c.s, 'seg'],
          ] as [number, string][]).map(([v, l]) => (
            <span key={l}>
              <b>{String(v).padStart(2, '0')}</b>
              {t(l)}
            </span>
          ))}
        </div>
      )}
      <div className="tr-barra">
        <i style={{ width: pct + '%' }} />
      </div>
      <div className="tr-curso-pe">
        <small>
          {t('Deve ficar concluída até')} {new Date(fimMs).toLocaleDateString('pt-PT')}
        </small>
        <button className="btn sm g" onClick={onVer}>
          <i className="fa-solid fa-eye" />
          {t('Ver')}
        </button>
      </div>
    </div>
  );
}

/** Popup com o pedido: estado e explicação, pagamento e o DNS atual do domínio (nameservers e MX) */
function VerPedido({ p }: { p: Pedido }) {
  const { t, closeM } = useVH();
  const { formatPrice } = useCurrency();
  const [dns, setDns] = useState<{ nameservers: string[]; mailExchangers: string[] } | null | 'erro'>(null);
  useEffect(() => {
    fetch('/api/domain-transfer/dns-snapshot?domain=' + encodeURIComponent(p.domain_name), { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => setDns(j?.success ? j : 'erro'))
      .catch(() => setDns('erro'));
  }, [p.domain_name]);
  const [txt, cor, explica] = ESTADO[p.status];
  return (
    <div className="tr-ver">
      <h3>{p.domain_name}</h3>
      <p>
        <span className={'tag ' + cor}>{t(txt)}</span>
      </p>
      {(explica || p.error_message) && <p className="tr-explica">{p.error_message || t(explica || '')}</p>}
      <div className="tr-ver-grelha">
        <span>{t('Pedido')}</span>
        <b>{p.order?.orderId || '—'}</b>
        <span>{t('Data')}</span>
        <b>{new Date(p.created_at).toLocaleString('pt-PT')}</b>
        <span>{t('Valor')}</span>
        <b>{p.order ? formatPrice(p.order.costMt) : '—'}</b>
        <span>{t('Pagamento')}</span>
        <b>{p.order ? t(PAGAMENTO[p.order.status]?.[0] || p.order.status) + ' · ' + (METODO[p.order.metodoPagamento] || p.order.metodoPagamento) : '—'}</b>
      </div>
      <h4>{t('DNS atual do domínio')}</h4>
      {dns === null ? (
        <p className="tr-explica">{t('A consultar o DNS…')}</p>
      ) : dns === 'erro' || (!dns.nameservers.length && !dns.mailExchangers.length) ? (
        <p className="tr-explica">{t('Sem resposta de DNS neste momento.')}</p>
      ) : (
        <div className="tr-ver-grelha">
          <span>Nameservers</span>
          <b className="tr-mono">{dns.nameservers.join(', ') || '—'}</b>
          <span>{t('E-mail (MX)')}</span>
          <b className="tr-mono">{dns.mailExchangers.join(', ') || '—'}</b>
        </div>
      )}
      <div className="mfoot">
        <button className="btn r" onClick={closeM}>
          {t('Fechar')}
        </button>
      </div>
    </div>
  );
}

export function TransferirDominio() {
  const vh = useVH();
  const { t, openM } = vh;
  const { addItem } = useCart();
  const { formatPrice } = useCurrency();
  const { dados, ler } = useGet<{ success?: boolean; pedidos?: Pedido[] }>(ROTA);
  const pedidos = dados?.pedidos || [];
  const [dominio, setDominio] = useState('');
  const [epp, setEpp] = useState('');
  const [aValidar, setAValidar] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  const [preco, setPreco] = useState<number | null>(null);
  const [validado, setValidado] = useState('');
  // data de início real do pedido na Dynadot (é a que conta para o prazo dela)
  const [inicioReal, setInicioReal] = useState<Record<string, string>>({});

  // pedidos em curso: confirma o estado na Dynadot logo e a cada 30 s
  const chaveCurso = pedidos.filter(emCurso).map((p) => p.domain_name + ':' + p.status).join(',');
  useEffect(() => {
    const curso = pedidos.filter(emCurso);
    if (!curso.length) return;
    const atualizar = () =>
      Promise.all(
        curso.map((p) =>
          fetch('/api/domain-transfer/status?domain=' + encodeURIComponent(p.domain_name), { credentials: 'include' })
            .then((r) => r.json())
            .then((j) => (j?.success && j.createdAt ? [p.domain_name, j.createdAt as string] : null))
            .catch(() => null),
        ),
      ).then((res) => {
        setInicioReal((prev) => ({ ...prev, ...Object.fromEntries(res.filter(Boolean) as [string, string][]) }));
        esquecerMemoria(ROTA);
        void ler(true);
      });
    atualizar();
    const iv = setInterval(atualizar, 30_000);
    return () => clearInterval(iv);
  }, [chaveCurso]); // eslint-disable-line react-hooks/exhaustive-deps

  const limpar = () => {
    setDominio('');
    setEpp('');
    setMsg(null);
    setPreco(null);
    setValidado('');
  };

  const validar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dominio.trim() || !epp.trim()) return;
    setAValidar(true);
    setMsg(null);
    setPreco(null);
    try {
      const d = dominio.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
      const r = await fetch('/api/domain-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: d, tld: '' }) });
      const j = await r.json();
      if (j.error) return setMsg({ ok: false, txt: j.error });
      if (j.available) return setMsg({ ok: false, txt: 'Este domínio está livre — ninguém o possui, por isso não há nada para transferir. Registe-o no separador "Registar domínio".' });
      if (j.alreadyOurs) return setMsg({ ok: false, txt: 'Este domínio já está registado connosco — não é preciso transferir.' });
      const pr = await (await fetch('/api/domain-tld-prices')).json();
      const tld = (pr.prices || []).find((x: { value: string }) => d.endsWith(x.value));
      if (!tld) return setMsg({ ok: false, txt: 'Não reconhecemos esta extensão de domínio.' });
      // o mesmo preço do painel antigo (custo da Dynadot em USD × MZN_TO_USD_RATE)
      setPreco(Math.round(tld.transfer * MZN_TO_USD_RATE));
      setValidado(d);
      setMsg({ ok: true, txt: 'Domínio ' + d + ' confirmado como registado noutro lado — pronto para pedir a transferência.' });
    } catch (err) {
      setMsg({ ok: false, txt: err instanceof Error ? err.message : 'Erro ao validar o domínio.' });
    } finally {
      setAValidar(false);
    }
  };

  // como no "Registar domínio" do painel: vai para o carrinho e segue logo para o pagamento
  const paraOCarrinho = () => {
    if (!validado || preco === null) return;
    addItem({ id: validado, type: 'domain', name: validado, price: preco, period: 1, authCode: epp.trim() });
    window.location.href = '/checkout';
  };

  const curso = pedidos.filter(emCurso);
  return (
    <>
      <form className="tr-form" onSubmit={validar}>
        <label>
          {t('Domínio')}
          <input
            value={dominio}
            onChange={(e) => {
              setDominio(e.target.value);
              setPreco(null);
            }}
            placeholder="exemplo.com"
            className="tr-mono"
          />
        </label>
        <label>
          {t('Código EPP')}
          <input
            value={epp}
            onChange={(e) => {
              setEpp(e.target.value);
              setPreco(null);
            }}
            placeholder={t('Código do registador atual')}
            className="tr-mono"
          />
        </label>
        <div className="tr-botoes">
          {preco !== null ? (
            <button type="button" className="btn r" onClick={paraOCarrinho}>
              <i className="fa-solid fa-cart-shopping" />
              {t('Pagar a transferência')} — {formatPrice(preco)}
            </button>
          ) : (
            <button type="submit" className="btn r" disabled={aValidar || !dominio.trim() || !epp.trim()}>
              <i className={'fa-solid ' + (aValidar ? 'fa-spinner fa-spin' : 'fa-right-left')} />
              {t('Validar domínio')}
            </button>
          )}
          <button type="button" className="btn g" onClick={limpar}>
            {t('Limpar')}
          </button>
        </div>
      </form>
      {msg && <p className={'tr-msg ' + (msg.ok ? 'ok' : 'bad')}>{t(msg.txt)}</p>}

      {curso.length > 0 && (
        <div className="tr-cursos">
          {curso.map((p) => (
            <EmCurso key={p.id} p={p} inicio={inicioReal[p.domain_name] || p.created_at} onVer={() => openM(<VerPedido p={p} />)} />
          ))}
        </div>
      )}

      <DataTable
        id="transferencias"
        umaLinha
        barraFora
        semBusca={false}
        rows={pedidos}
        rowKey={(r) => r.id}
        search={(r) => r.domain_name + ' ' + (r.order?.orderId || '')}
        empty="Ainda não há pedidos de transferência"
        cols={[
          { k: 'd', t: 'Domínio', sort: (r) => r.domain_name, cell: (r) => <b className="tr-mono">{r.domain_name}</b> },
          { k: 'p', t: 'Pedido', cell: (r) => r.order?.orderId || '—' },
          { k: 'data', t: 'Data', sort: (r) => r.created_at, cell: (r) => new Date(r.created_at).toLocaleDateString('pt-PT') },
          { k: 'v', t: 'Valor', right: true, cell: (r) => (r.order ? formatPrice(r.order.costMt) : '—') },
          {
            k: 'pg',
            t: 'Pagamento',
            cell: (r) =>
              r.order ? (
                <span className="tr-pag">
                  <span className={'tag ' + (PAGAMENTO[r.order.status]?.[1] || 'off')}>{t(PAGAMENTO[r.order.status]?.[0] || r.order.status)}</span>
                  <small>{METODO[r.order.metodoPagamento] || r.order.metodoPagamento}</small>
                </span>
              ) : (
                '—'
              ),
          },
          { k: 'e', t: 'Transferência', sort: (r) => r.status, cell: (r) => <span className={'tag ' + ESTADO[r.status][1]}>{t(ESTADO[r.status][0])}</span> },
        ]}
        actions={(r) => (
          <button className="btn sm g" onClick={() => openM(<VerPedido p={r} />)}>
            <i className="fa-solid fa-eye" />
            {t('Ver')}
          </button>
        )}
      />

      <p className="fb-nota">
        {t('Como funciona:')} {PASSOS.map((p, i) => (i + 1) + '. ' + t(p)).join(' ')} {t('O domínio continua ativo durante a transferência.')}{' '}
        <a className="lk" href="/ajuda/dominios/transferir" target="_blank" rel="noreferrer">
          {t('Saber mais')}
        </a>
      </p>
    </>
  );
}
