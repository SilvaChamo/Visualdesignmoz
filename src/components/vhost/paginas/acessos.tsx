'use client';

// Admin › Acessos por plano (pedido do Silva, 15/10/2026): para cada plano, o que os clientes vêem na barra lateral da
// Gestão. Um cliente com um plano de profissional deixava de ver, por ex., a edição de domínios só desligando aqui.
// Guardado no servidor (/api/vhost/acessos); administradores e revendedores vêem sempre tudo.
import { useEffect, useState } from 'react';
import { useVH, type VH } from '../context';
import { MENU } from '../generated/data';
import type { ScreenFn } from '../screens';
import { Check, Frm } from './componentes';

function AcessosPlanos({ plano }: { plano: string }) {
  const { s, t, toast, setAcessos } = useVH();
  const [rascunho, setRascunho] = useState<Record<string, string[]>>(() => structuredClone(s.acessos || {}));
  const [aGravar, setAGravar] = useState(false);
  const [mexido, setMexido] = useState(false);
  // os acessos guardados chegam do servidor depois de a página abrir: mostra-os enquanto nada foi mexido aqui
  useEffect(() => {
    if (!mexido) setRascunho(structuredClone(s.acessos || {}));
  }, [s.acessos, mexido]);
  const escondidos = rascunho[plano] || [];
  const mudar = (id: string, ver: boolean) => {
    setMexido(true);
    setRascunho((r) => ({ ...r, [plano]: ver ? (r[plano] || []).filter((x) => x !== id) : [...new Set([...(r[plano] || []), id])] }));
  };
  const grupos = MENU.utilizador.filter(([g]) => g !== 'Início');
  const gravar = async () => {
    setAGravar(true);
    try {
      const r = await fetch('/api/vhost/acessos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acessos: rascunho }) });
      const j = (await r.json().catch(() => ({}))) as { erro?: string; acessos?: Record<string, string[]> };
      if (!r.ok) return toast(j.erro || 'Não foi possível gravar');
      setAcessos(j.acessos || rascunho);
      setMexido(false);
      toast(t('Acessos gravados'));
    } catch {
      toast('Sem ligação ao site. Nada foi gravado.');
    } finally {
      setAGravar(false);
    }
  };
  if (!plano) return <div className="empty card">{t('Ainda não há planos no servidor')}</div>;
  return (
    <>
      <div>
        <div>
          {grupos.map(([g, itens]) => (
            <Frm key={g} title={g} desc={t('Assinale o que os clientes deste plano vêem')}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px 18px', padding: '14px 18px' }}>
                {itens.map((it) => (
                  <Check key={it.id} checked={!escondidos.includes(it.id)} onChange={(v) => mudar(it.id, v)} label={it.t} />
                ))}
              </div>
            </Frm>
          ))}
        </div>
      </div>
      <div className="acoes-topo">
        <button className="btn r" disabled={aGravar} onClick={gravar}>
          <i className="fa-solid fa-floppy-disk" />
          {t('Guardar')}
        </button>
      </div>
    </>
  );
}

// Cada plano é um submenu de Admin › Configurações de acesso (/admin/acessos/<plano>); sem plano no endereço, o primeiro
export const acessosPlanos: ScreenFn = (vh: VH) => {
  const planos = Object.keys(vh.s.db.pkgs).filter((p) => p !== 'system');
  const plano = vh.s.sub[0] && planos.includes(vh.s.sub[0]) ? vh.s.sub[0] : planos[0] || '';
  return {
    title: plano ? vh.t('Acessos do plano {0}').replace('{0}', plano) : 'Acessos por plano',
    desc: vh.t('O que os clientes deste plano vêem na barra lateral'),
    crumbs: plano ? [{ t: 'Acessos por plano', path: '/admin/acessos' }, { t: plano }] : undefined,
    body: <AcessosPlanos key={plano} plano={plano} />,
  };
};
