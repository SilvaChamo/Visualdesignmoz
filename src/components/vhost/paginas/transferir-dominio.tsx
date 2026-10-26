'use client';

// Transferir domínio — cópia da página do painel antigo (src/app/dashboard/DomainTransferSection.tsx), pedido do Silva
// (13/10/2026): "assim como está na imagem … copiar todo o código do painel que estamos a substituir". O mesmo processo e
// as mesmas rotas (/api/domain-check, /api/domain-tld-prices, /api/domain-transfer, /api/domain-transfer/status e
// /api/domain-transfer/dns-snapshot): domínio + código EPP → validar → preço → carrinho e pagamento; depois do pagamento
// o pedido segue sozinho para a Dynadot (checkout-fulfillment) e o cron domain-transfer-check acompanha-o.
// O desenho é o mesmo do painel antigo, mas com o CSS do painel (paginas.css, .trf-*): o painel anula as margens do
// Tailwind (.vh *{margin:0}), por isso o componente antigo não podia vir tal e qual.
import { useContext, useEffect, useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { MZN_TO_USD_RATE } from '@/lib/currency';
import { PesquisaPagina, useVH } from '../context';
import { EsperaPagina, esquecerMemoria, useGet } from '../carga';

type Encomenda = { orderId: string; costMt: number; paidMt: number; metodoPagamento: string; status: 'pending' | 'paid' | 'failed' };
type Pedido = {
  id: string;
  domain_name: string;
  status: 'pending' | 'submitted' | 'waiting' | 'locked' | 'completed' | 'rejected' | 'failed';
  error_message?: string | null;
  created_at: string;
  order?: Encomenda | null;
};

const ROTA = '/api/domain-transfer';
const METODO: Record<string, string> = { mpesa: 'M-Pesa', emola: 'e-Mola', transferencia: 'Transferência', stripe: 'Cartão' };
/** coluna "Status" dos Pedidos Abertos: o estado do pagamento; "Concluído" quando a Dynadot já confirmou a transferência */
const PAGAMENTO: Record<Encomenda['status'], [string, string]> = {
  pending: ['A aguardar pagamento', 'w'],
  paid: ['Processando', 'p'],
  failed: ['Pagamento rejeitado', 'bad'],
};
const CONCLUIDO: [string, string] = ['Concluído', 'ok'];
const emCurso = (p: Pedido) => p.status === 'submitted' || p.status === 'waiting' || p.status === 'locked';
/** a ICANN dá ao registador anterior até 5–7 dias para responder; usamos 7 (o pior caso) para não prometer mais rápido */
const DIAS = 7;
const DICAS: [string, string][] = [
  ['Sem mudanças recentes', 'Seu domínio não pode ter sido registrado, transferido ou atualizado nos últimos 60 dias. Recomendamos iniciar sua transferência pelo menos 2 semanas antes do vencimento.'],
  ['Email Whois atualizado', 'Certifique-se de que seu endereço de e-mail Whois está correto. É para lá que o link de aprovação da transferência será enviado.'],
  ['Renovação de 1 ano incluída', 'Quando a transferência for concluída, você estenderá automaticamente seu registro por 1 ano (algumas exceções de TLD se aplicam).'],
  ['Dica rápida para transferência', 'Se seu domínio expirou recentemente, talvez ainda seja possível transferi-lo após renová-lo no seu agente de registros atual.'],
];

function useContagem(fimMs: number) {
  const calc = () => Math.max(0, fimMs - Date.now());
  const [falta, setFalta] = useState(calc);
  useEffect(() => {
    setFalta(calc());
    const iv = setInterval(() => setFalta(calc()), 1000);
    return () => clearInterval(iv);
  }, [fimMs]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    d: Math.floor(falta / 864e5),
    h: Math.floor((falta % 864e5) / 36e5),
    m: Math.floor((falta % 36e5) / 6e4),
    s: Math.floor((falta % 6e4) / 1e3),
    fim: falta === 0,
  };
}

/** DNS atual do domínio (ainda no registador antigo): nameservers e MX */
function DnsAtual({ dominio }: { dominio: string }) {
  const { t } = useVH();
  const [dns, setDns] = useState<{ nameservers: string[]; mailExchangers: string[] } | null | 'erro'>(null);
  const espera = useContext(EsperaPagina);
  useEffect(() => {
    let vivo = true;
    const acabou = espera?.comecar(); // a página espera pelo DNS antes de aparecer
    fetch('/api/domain-transfer/dns-snapshot?domain=' + encodeURIComponent(dominio), { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => vivo && setDns(j?.success ? j : 'erro'))
      .catch(() => vivo && setDns('erro'))
      .finally(() => acabou?.());
    return () => {
      vivo = false;
    };
  }, [dominio]);
  if (dns === null) return <p className="trf-dns">{t('A consultar o DNS…')}</p>;
  if (dns === 'erro' || (!dns.nameservers.length && !dns.mailExchangers.length)) return <p className="trf-dns">{t('Sem resposta de DNS neste momento.')}</p>;
  return (
    <p className="trf-dns">
      {dns.nameservers.length > 0 && (
        <span>
          <b>Nameservers</b> {dns.nameservers.join(', ')}
        </span>
      )}
      {dns.mailExchangers.length > 0 && (
        <span>
          <b>{t('E-mail (MX)')}</b> {dns.mailExchangers.join(', ')}
        </span>
      )}
    </p>
  );
}

/** Uma transferência em curso: contagem até ao prazo de 7 dias e barra de progresso. É só uma estimativa — quem
 *  confirma o fim é a verificação automática à Dynadot (a cada ~30 min), que só então tira o pedido daqui. */
function EmCurso({ p, inicio }: { p: Pedido; inicio: string }) {
  const { t } = useVH();
  const ini = new Date(inicio).getTime();
  const fimMs = ini + DIAS * 864e5;
  const c = useContagem(fimMs);
  const pct = Math.min(100, Math.max(4, Math.round(((Date.now() - ini) / (DIAS * 864e5)) * 100)));
  return (
    <div className="trf-curso">
      <div className="trf-curso-topo">
        <b>{p.domain_name}</b>
        <span className={'trf-emcurso' + (p.status === 'locked' ? ' bloq' : '')}>{t(p.status === 'locked' ? 'Bloqueada' : 'Em curso')}</span>
      </div>
      <p className="trf-curso-txt">
        {t('Iniciado, deve ser concluído até')} <b>{new Date(fimMs).toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}</b>
      </p>
      {p.status === 'locked' && (
        <p className="trf-curso-aviso">
          {t('O domínio está "bloqueado" (locked) no registador antigo, o que impede a transferência de avançar. Entre na conta desse registador (ou peça ao suporte dele) e desative o bloqueio de transferência ("unlock"). Assim que desbloquear, o processo continua sozinho.')}
        </p>
      )}
      <div className="trf-relogio">
        <small>{t('Tempo restante de transferência')}</small>
        {c.fim ? (
          <p className="trf-atraso">
            <i className="fa-regular fa-clock" />
            {t('A demorar mais do que o previsto — ainda em curso')}
          </p>
        ) : (
          <div className="trf-contagem">
            {([
              [c.d, 'dias'],
              [c.h, 'horas'],
              [c.m, 'min'],
              [c.s, 'seg'],
            ] as [number, string][]).map(([v, l], n) => (
              <span key={l} className="trf-unid">
                {n > 0 && <i>:</i>}
                <span>
                  <b>{String(v).padStart(2, '0')}</b>
                  <small>{t(l)}</small>
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="trf-barra">
        <i style={{ width: pct + '%' }} />
      </div>
      <DnsAtual dominio={p.domain_name} />
    </div>
  );
}

/** O formulário não depende da lista de pedidos: a página abre logo e os "Pedidos Abertos" entram quando chegam (a leitura demora
 *  — vai à base de dados duas vezes — e a página inteira ficava à espera dela; Silva, 21/10/2026) */
export function TransferirDominio() {
  return (
    <EsperaPagina.Provider value={null}>
      <TransferirConteudo />
    </EsperaPagina.Provider>
  );
}

function TransferirConteudo() {
  const vh = useVH();
  const { t } = vh;
  const { addItem } = useCart();
  const { formatPrice } = useCurrency();
  const pesqPagina = useContext(PesquisaPagina);
  const { dados, ler } = useGet<{ success?: boolean; pedidos?: Pedido[] }>(ROTA);
  const pedidos = dados?.pedidos || [];
  const [dominio, setDominio] = useState('');
  const [epp, setEpp] = useState('');
  const [aValidar, setAValidar] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  const [preco, setPreco] = useState<number | null>(null);
  const [validado, setValidado] = useState('');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [realce, setRealce] = useState<string | null>(null);
  // data de início real do pedido na Dynadot (order_created_date): é a que conta para o prazo dela
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

  const comEncomenda = pedidos.filter((p) => p.order);

  // a lupa da barra de cima também procura nos pedidos desta página
  const chavePedidos = comEncomenda.map((p) => p.id).join(',');
  useEffect(() => {
    if (!pesqPagina) return;
    return pesqPagina.registar('transferencias', () =>
      comEncomenda.map((p) => ({
        k: 'transferencias:' + p.id,
        txt: p.domain_name + ' ' + (p.order?.orderId || ''),
        sub: t('Pedidos Abertos'),
        fa: 'fa-solid fa-right-left',
        ir: () => {
          setRealce(p.id);
          setTimeout(() => document.querySelector<HTMLElement>('tr[data-trf="' + CSS.escape(p.id) + '"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
          setTimeout(() => setRealce((x) => (x === p.id ? null : x)), 2600);
        },
      })),
    );
  }, [pesqPagina, chavePedidos]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const todos = comEncomenda.length > 0 && comEncomenda.every((p) => marcados.has(p.id));
  const marcar = (id: string) =>
    setMarcados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const curso = pedidos.filter(emCurso);
  return (
    <div className="trf">
      {/* Cartão principal em 2 colunas: formulário à esquerda, processo de transferência à direita */}
      <section className="trf-cartao">
        <div className="trf-grelha">
          <div className="trf-esq">
            <div className="trf-cab">
              <span className="trf-cab-ic">
                <i className="fa-solid fa-right-left" />
              </span>
              <div>
                <b>{t('Transferência de Domínio')}</b>
                <p>{t('Introduza o domínio e o código de autorização (EPP) do registador atual. O domínio permanece ativo durante a transferência.')}</p>
              </div>
            </div>
            <form className="trf-form" onSubmit={validar}>
              <div className="trf-campos">
                <label>
                  <span>{t('Domínio')}</span>
                  <span className="igrp">
                    <span className="ib" style={{ cursor: 'default' }}>
                      <i className="fa-solid fa-globe" />
                    </span>
                    <input
                      value={dominio}
                      onChange={(e) => {
                        setDominio(e.target.value);
                        setPreco(null);
                      }}
                      placeholder="exemplo.com"
                      required
                    />
                  </span>
                </label>
                <label>
                  <span>{t('Código EPP')}</span>
                  <input
                    value={epp}
                    onChange={(e) => {
                      setEpp(e.target.value);
                      setPreco(null);
                    }}
                    placeholder={t('Código do registador')}
                    required
                  />
                </label>
              </div>
              {msg && (
                <div className={'trf-msg ' + (msg.ok ? 'ok' : 'bad')}>
                  {t(msg.txt)}
                  {msg.ok && preco !== null && (
                    <b>
                      {t('Preço da transferência:')} {formatPrice(preco)}
                    </b>
                  )}
                </div>
              )}
              <div className="trf-botoes">
                {preco !== null ? (
                  <button type="button" className="btn trf-btn-p" onClick={paraOCarrinho}>
                    <i className="fa-solid fa-cart-shopping" />
                    {t('Adicionar ao carrinho')} — {formatPrice(preco)}
                  </button>
                ) : (
                  <button type="submit" className="btn trf-btn-p" disabled={aValidar || !dominio.trim() || !epp.trim()}>
                    <i className="fa-solid fa-right-left" />
                    {t('Validar domínio')}
                  </button>
                )}
                <button type="button" className="btn g trf-limpar" onClick={limpar}>
                  {t('Limpar')}
                </button>
              </div>
            </form>
          </div>

          <div className="trf-dir">
            <h4>
              <i className="fa-solid fa-stopwatch" />
              {t('Processo de Transferência')}
            </h4>
            {curso.length > 0 ? (
              <div className="trf-cursos">
                {curso.map((p) => (
                  <EmCurso key={p.id} p={p} inicio={inicioReal[p.domain_name] || p.created_at} />
                ))}
              </div>
            ) : (
              <div className="trf-vazio">
                <i className="fa-regular fa-clock" />
                <p>{t('Nenhuma transferência em curso no momento.')}</p>
                <small>{t('Insira o domínio e código EPP ao lado para iniciar um novo pedido.')}</small>
              </div>
            )}
          </div>
        </div>

        <div className="trf-confianca">
          <span>
            {t('Agente de registro credenciado pela')} <b>ICANN</b>
          </span>
          <span>
            {t('Confiado por')} <b>10M+</b> {t('Clientes')}
          </span>
          <span>
            {t('Mais de')} <b>8M+</b> {t('Domínios')}
          </span>
          <span>
            <b>{t('Grátis')}</b> {t('Privacidade WHOIS')}
          </span>
          <span className="trf-estrelas">
            <b>Excellent</b>
            {[1, 2, 3, 4, 5].map((i) => (
              <i key={i}>★</i>
            ))}
            <b className="trf-tp">
              <em>★</em> Trustpilot
            </b>
          </span>
        </div>
      </section>

      {comEncomenda.length > 0 && (
        <section className="trf-cartao trf-pedidos">
          <h3>{t('Pedidos Abertos')}</h3>
          <div className="trf-tabela">
            <table>
              <thead>
                <tr>
                  <th className="trf-chk">
                    <input type="checkbox" checked={todos} onChange={() => setMarcados(todos ? new Set() : new Set(comEncomenda.map((p) => p.id)))} aria-label={t('Selecionar todos')} />
                  </th>
                  <th>{t('Itens')}</th>
                  <th>{t('ID do Pedido')}</th>
                  <th>{t('Data de Envio')}</th>
                  <th>{t('Custo')}</th>
                  <th>{t('Pago')}</th>
                  <th>
                    {t('Status')}{' '}
                    <span className="trf-ajuda" title={t('Estado do pagamento do pedido de transferência')}>
                      ?
                    </span>
                  </th>
                  <th>{t('Tipo de Pagamento')}</th>
                </tr>
              </thead>
              <tbody>
                {comEncomenda.map((p) => {
                  const o = p.order as Encomenda;
                  const [txt, cor] = p.status === 'completed' ? CONCLUIDO : PAGAMENTO[o.status] || [o.status, 'w'];
                  return (
                    <tr key={p.id} data-trf={p.id} className={(marcados.has(p.id) ? 'sel ' : '') + (realce === p.id ? 'trf-realce' : '')}>
                      <td className="trf-chk">
                        <input type="checkbox" checked={marcados.has(p.id)} onChange={() => marcar(p.id)} aria-label={t('Selecionar') + ' ' + p.domain_name} />
                      </td>
                      <td className="trf-dom">{p.domain_name}</td>
                      <td className="trf-fraco">{o.orderId}</td>
                      <td className="trf-fraco">{new Date(p.created_at).toLocaleDateString('pt-PT')}</td>
                      <td>
                        <b>{formatPrice(o.costMt)}</b>
                      </td>
                      <td className="trf-fraco">{formatPrice(o.paidMt)}</td>
                      <td>
                        <span className={'trf-estado ' + cor}>
                          <i />
                          {t(txt)}
                        </span>
                      </td>
                      <td className="trf-fraco">{METODO[o.metodoPagamento] || o.metodoPagamento}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Antes de transferir: o domínio sai do registador atual e passa para nós */}
      <section className="trf-cartao trf-antes">
        <div className="trf-antes-esq">
          {/* o domínio sai do registador atual (globo) e passa para nós (escudo com o visto) */}
          <div className="trf-ilustra" aria-hidden="true">
            <figure>
              <span className="trf-bola de">
                <i className="fa-solid fa-globe" />
              </span>
              <figcaption>{t('Registador atual')}</figcaption>
            </figure>
            <span className="trf-via">
              <i className="fa-solid fa-chevron-right" />
            </span>
            <figure>
              <span className="trf-bola para">
                <i className="fa-solid fa-shield-halved" />
                <em>
                  <i className="fa-solid fa-check" />
                </em>
              </span>
              <figcaption>{vh.s.brand.name.trim() || 'VisualDesign'}</figcaption>
            </figure>
          </div>
          <h3>{t('Antes de transferir seu domínio')}</h3>
          <p>
            {t('Antes de iniciar sua')} <u>{t('transferência de domínio')}</u>
            {t(', reserve um momento rápido para garantir que tudo esteja pronto. Um início tranquilo significa que sua transferência será concluída mais rapidamente.')}
          </p>
          <a className="btn trf-btn-p" href="/ajuda/dominios/transferir" target="_blank" rel="noopener noreferrer">
            {t('Veja nosso guia de como transferir um domínio')}
            <i className="fa-solid fa-chevron-right" />
          </a>
        </div>
        <div className="trf-antes-dir">
          {DICAS.map(([tit, txt]) => (
            <div key={tit} className="trf-dica">
              <i className="fa-regular fa-circle-check" />
              <div>
                <h4>{t(tit)}</h4>
                <p>{t(txt)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
