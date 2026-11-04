'use client';

// Admin e Revenda › Diagnóstico de passagem (Silva, 4/11/2026): quando a passagem de um domínio de uma conta para outra não
// corre bem, aqui vê-se o que aconteceu (o motivo guardado e o que está agora no servidor) e o que fazer, com reparações
// seguras (nunca apagam nada) e, se for preciso, passar o domínio de volta. A leitura e as reparações são do servidor:
// /api/vhost/passar (?diagnostico= e { reparar }), só para administrador e revendedor.
import { useMemo, useState } from 'react';
import { useVH } from '../context';
import type { MenuItem } from '../types';
import type { ScreenFn } from '../screens';
import { DESC, EN, MENU } from '../generated/data';
import { arrumarMenuContas } from '../menu-contas';
import { Frm, Row } from './componentes';
import { RelatorioDns, type ItemRel } from './dominios';
import { PassarDominioModal } from './passar';

// ---------- Menu: a seguir a "Mover clientes" (administrador) e a "Mudar senhas" (revenda) ----------
{
  const item: MenuItem = {
    id: 'diagnostico-passagem',
    fa: 'fa-stethoscope',
    t: 'Diagnóstico de passagem',
    c: 'c7',
    da: '—',
    f: ['Porque é que a passagem de um domínio não terminou', 'O que está agora no servidor e o que fazer', 'Reparações seguras e voltar à conta anterior'],
    hx: { s: 'app', cmd: 'v-search-domain-owner', n: 'Leitura do servidor; as reparações nunca apagam nada' },
  };
  const admin = MENU.admin.find(([g]) => g === 'Gestão de contas');
  if (admin && !admin[1].some((it) => it.id === item.id)) admin[1].push(item);
  const revenda = MENU.revenda.find(([g]) => g === 'Gestão de contas');
  if (revenda && !revenda[1].some((it) => it.id === item.id)) {
    const i = revenda[1].findIndex((it) => it.id === 'senhas');
    revenda[1].splice(i >= 0 ? i + 1 : revenda[1].length, 0, item);
  }
  arrumarMenuContas();
  const desc: [string, string] = ['Porque é que a passagem de um domínio não correu bem e o que fazer', 'Why a domain transfer did not go well and what to do'];
  DESC['admin/diagnostico-passagem'] = desc;
  DESC['revenda/diagnostico-passagem'] = desc;
  const novas: Record<string, string> = {
    'Diagnóstico de passagem': 'Transfer diagnosis',
    'Domínio a diagnosticar': 'Domain to diagnose',
    'Diagnosticar': 'Diagnose',
    'A diagnosticar…': 'Diagnosing…',
    'O que fazer': 'What to do',
    'Nenhuma acção necessária.': 'No action needed.',
    'Passar de volta para a conta': 'Pass back to the account',
    'Sincronizar o PHP da conta': 'Sync the account PHP',
    'Reconstruir o site': 'Rebuild the site',
    'Reactivar o site': 'Reactivate the site',
    'Pôr os ficheiros com o dono certo': 'Set the right owner on the files',
    'Escreva o domínio, por exemplo meusite.com': 'Enter the domain, for example mysite.com',
    'Feito': 'Done',
    'Verificações': 'Checks',
    'Última passagem': 'Last transfer',
    'Sem ligação ao site.': 'No connection to the site.',
    'Reparar': 'Repair',
    'A reparar…': 'Repairing…',
  };
  for (const [pt, en] of Object.entries(novas)) if (!(pt in EN)) EN[pt] = en;
}

type Verificacao = { nome: string; estado: 'ok' | 'aviso' | 'erro'; detalhe: string };
type Accao = { id: 'php' | 'reconstruir' | 'reactivar' | 'donos' | 'voltar'; texto: string; porque: string };
type Diag = {
  dominio: string;
  dono: string;
  historico: { quando: string; de: string; para: string; ok: boolean; erro: string; copia: string } | null;
  de: string;
  verificacoes: Verificacao[];
  accoes: Accao[];
  resumo: string;
  erro?: string;
};

const ESTADO: Record<Verificacao['estado'], ItemRel['estado']> = { ok: 'certo', aviso: 'pendente', erro: 'falhou' };

function Diagnostico() {
  const vh = useVH();
  const { t } = vh;
  const [dominio, setDominio] = useState('');
  const [d, setD] = useState<Diag | null>(null);
  const [erro, setErro] = useState('');
  const [aLer, setALer] = useState(false);
  const [aReparar, setAReparar] = useState('');
  const conhecidos = useMemo(
    () => [...new Set(Object.values(vh.s.acc).flatMap((a) => a.domains.map((x) => x.name)))].sort(),
    [vh.s.acc],
  );

  const ler = async (alvo: string) => {
    const dom = alvo.trim().toLowerCase();
    if (!dom) return;
    setALer(true);
    setErro('');
    try {
      const r = await fetch('/api/vhost/passar?diagnostico=' + encodeURIComponent(dom), { cache: 'no-store' });
      const j = (await r.json().catch(() => ({}))) as Diag;
      if (!r.ok || j.erro) {
        setD(null);
        setErro(j.erro || 'Não foi possível diagnosticar.');
      } else setD(j);
    } catch {
      setD(null);
      setErro('Sem ligação ao site.');
    }
    setALer(false);
  };

  const reparar = async (a: Accao) => {
    if (!d) return;
    if (a.id === 'voltar') {
      vh.openM(<PassarDominioModal dominio={d.dominio} />);
      return;
    }
    setAReparar(a.id);
    vh.toast(t('A reparar…'));
    try {
      const r = await fetch('/api/vhost/passar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dominio: d.dominio, reparar: a.id }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; mensagem?: string; erro?: string };
      vh.toast(j.mensagem || j.erro || (r.ok ? t('Feito') : 'Não foi possível reparar.'));
    } catch {
      vh.toast('Sem ligação ao site. Nada foi alterado.');
    }
    setAReparar('');
    await ler(d.dominio);
  };

  return (
    <>
      <Frm title="Diagnóstico de passagem" desc="Porque é que a passagem de um domínio não correu bem e o que fazer">
        <Row label="Domínio a diagnosticar">
          <div className="igrp">
            <input
              list="diag-dominios"
              value={dominio}
              onChange={(e) => setDominio(e.target.value.trim().toLowerCase())}
              onKeyDown={(e) => e.key === 'Enter' && void ler(dominio)}
              placeholder={t('Escreva o domínio, por exemplo meusite.com')}
              aria-label={t('Domínio a diagnosticar')}
            />
            <datalist id="diag-dominios">
              {conhecidos.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
            <button className="btn r" disabled={aLer || !dominio} onClick={() => void ler(dominio)}>
              <i className="fa-solid fa-stethoscope" />
              {t(aLer ? 'A diagnosticar…' : 'Diagnosticar')}
            </button>
          </div>
        </Row>
      </Frm>
      {erro && <div className="note">{t(erro)}</div>}
      {d && (
        <>
          <div className="note">
            <i className="fa-solid fa-circle-info" style={{ color: 'var(--red)' }} /> {d.resumo}
          </div>
          <RelatorioDns dominio={d.dominio} itens={d.verificacoes.map((v) => ({ nome: v.nome, estado: ESTADO[v.estado], detalhe: v.detalhe }))} />
          <Frm title="O que fazer" desc={d.accoes.length ? 'Pela ordem: cada passo é seguro e o diagnóstico volta a correr no fim' : undefined}>
            {d.accoes.length === 0 ? (
              <div className="note">{t('Nenhuma acção necessária.')}</div>
            ) : (
              d.accoes.map((a) => (
                <Row key={a.id} label={a.id === 'voltar' ? t('Passar de volta para a conta') + ' ' + d.de : a.texto} hint={a.porque}>
                  <button className="btn r" disabled={!!aReparar} onClick={() => void reparar(a)}>
                    <i className={'fa-solid ' + (a.id === 'voltar' ? 'fa-right-left' : 'fa-screwdriver-wrench')} />
                    {t(aReparar === a.id ? 'A reparar…' : a.id === 'voltar' ? 'Passar de volta para a conta' : 'Reparar')}
                    {a.id === 'voltar' ? ' ' + d.de : ''}
                  </button>
                </Row>
              ))
            )}
          </Frm>
        </>
      )}
    </>
  );
}

export const diagnosticoPassagemPagina: ScreenFn = () => ({
  title: 'Diagnóstico de passagem',
  desc: 'Porque é que a passagem de um domínio não correu bem e o que fazer',
  body: <Diagnostico />,
});
