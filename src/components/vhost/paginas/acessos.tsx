'use client';

// Admin › Acessos por plano (pedido do Silva, 15/10/2026): para cada plano, o que os clientes vêem na barra lateral da
// Gestão. Um cliente com um plano de profissional deixava de ver, por ex., a edição de domínios só desligando aqui.
// Guardado no servidor (/api/vhost/acessos); administradores e revendedores vêem sempre tudo.
import { useState } from 'react';
import { useVH, type VH } from '../context';
import { MENU } from '../generated/data';
import type { ScreenFn } from '../screens';
import { Check, Frm, Tabs } from './componentes';

function AcessosPlanos() {
  const { s, t, toast, setAcessos } = useVH();
  const planos = Object.keys(s.db.pkgs).filter((p) => p !== 'system');
  const [plano, setPlano] = useState(planos[0] || '');
  const [rascunho, setRascunho] = useState<Record<string, string[]>>(() => structuredClone(s.acessos || {}));
  const [aGravar, setAGravar] = useState(false);
  const escondidos = rascunho[plano] || [];
  const mudar = (id: string, ver: boolean) =>
    setRascunho((r) => ({ ...r, [plano]: ver ? (r[plano] || []).filter((x) => x !== id) : [...new Set([...(r[plano] || []), id])] }));
  const grupos = MENU.utilizador.filter(([g]) => g !== 'Início');
  const gravar = async () => {
    setAGravar(true);
    try {
      const r = await fetch('/api/vhost/acessos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acessos: rascunho }) });
      const j = (await r.json().catch(() => ({}))) as { erro?: string; acessos?: Record<string, string[]> };
      if (!r.ok) return toast(j.erro || 'Não foi possível gravar');
      setAcessos(j.acessos || rascunho);
      toast(t('Acessos gravados'));
    } catch {
      toast('Sem ligação ao site. Nada foi gravado.');
    } finally {
      setAGravar(false);
    }
  };
  if (!planos.length) return <div className="empty card">{t('Ainda não há planos no servidor')}</div>;
  return (
    <>
      <div className="tabcard">
        {planos.length > 1 && <Tabs<string> tabs={planos.map((p) => [p, p, 'fa-box'] as [string, string, string])} on={plano} onChange={setPlano} />}
        <div className="tc">
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

export const acessosPlanos: ScreenFn = (vh: VH) => ({
  title: 'Acessos por plano',
  desc: vh.t('O que os clientes de cada plano vêem na barra lateral'),
  body: <AcessosPlanos />,
});
