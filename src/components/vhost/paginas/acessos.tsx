"use client";

// Admin › Acessos por plano (pedido do Silva, 15/10/2026): para cada plano, o que os clientes vêem na barra lateral da
// Gestão. Um cliente com um plano de profissional deixava de ver, por ex., a edição de domínios só desligando aqui.
// Guardado no servidor (/api/vhost/acessos); administradores e revendedores vêem sempre tudo.
import { useEffect, useState } from "react";
import { useVH, type VH } from "../context";
import { MENU } from "../generated/data";
import { isUser } from "../state";
import type { ScreenFn } from "../screens";
import { Check, Frm } from "./componentes";

// Escolhas ainda por gravar, de todos os planos. Ficam aqui, fora da página: cada plano abre como uma página nova e,
// antes, mudar de plano sem gravar perdia as escolhas sem aviso (os acessos do VD-Host-Basico nunca chegaram ao
// servidor — Silva, 16/10/2026). Só saem com "Guardar alterações" (ou ao recarregar o painel).
let porGravar: Record<string, string[]> | null = null;

const mesmaLista = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every((x) => b.includes(x));

function AcessosPlanos({ plano }: { plano: string }) {
  const { s, t, toast, setAcessos } = useVH();
  const [rascunho, setRascunho] = useState<Record<string, string[]>>(() => porGravar ?? structuredClone(s.acessos || {}));
  const [aGravar, setAGravar] = useState(false);
  // os acessos guardados chegam do servidor depois de a página abrir: mostram-se enquanto não há nada por gravar
  useEffect(() => {
    if (!porGravar) setRascunho(structuredClone(s.acessos || {}));
  }, [s.acessos]);
  const gravados = s.acessos || {};
  const planosPorGravar = [...new Set([...Object.keys(rascunho), ...Object.keys(gravados)])].filter(
    (p) => !mesmaLista(rascunho[p], gravados[p]),
  );
  // fechar ou recarregar o separador com escolhas por gravar: o navegador pergunta antes
  const temPorGravar = planosPorGravar.length > 0;
  useEffect(() => {
    if (!temPorGravar) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [temPorGravar]);
  const escondidos = rascunho[plano] || [];
  const aplicar = (fn: (lista: string[]) => string[]) => {
    const novo = { ...rascunho, [plano]: fn(rascunho[plano] || []) };
    porGravar = novo;
    setRascunho(novo);
  };
  const mudar = (id: string, ver: boolean) =>
    aplicar((l) => (ver ? l.filter((x) => x !== id) : [...new Set([...l, id])]));
  // o menu pai inteiro: desligar esconde todas as páginas dele (sem nenhuma, a barra lateral nem mostra o menu)
  const mudarGrupo = (ids: string[], ver: boolean) =>
    aplicar((l) => (ver ? l.filter((x) => !ids.includes(x)) : [...new Set([...l, ...ids])]));
  const grupos = MENU.utilizador.filter(([g]) => g !== "Início");
  const gravar = async () => {
    setAGravar(true);
    try {
      const r = await fetch("/api/vhost/acessos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acessos: rascunho }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        erro?: string;
        acessos?: Record<string, string[]>;
      };
      if (!r.ok) return toast(j.erro || "Não foi possível gravar");
      porGravar = null;
      setAcessos(j.acessos || rascunho);
      setRascunho(structuredClone(j.acessos || rascunho));
      toast(t("Alterações gravadas"));
    } catch {
      toast("Sem ligação ao site. Nada foi gravado.");
    } finally {
      setAGravar(false);
    }
  };
  if (!plano)
    return (
      <div className="empty card">{t("Ainda não há planos no servidor")}</div>
    );
  // quem está neste plano: os dois "Básico" (VD-Host-Basico e VD-Email-Basico) confundiam-se e os acessos ficavam
  // gravados no plano errado (Silva, 16/10/2026)
  const contasDoPlano = Object.entries(s.acc)
    .filter(([, a]) => isUser(a.role) && (a.pkg === plano || a.hpkg === plano))
    .map(([u, a]) => (a.name && a.name !== u ? `${a.name} (${u})` : u));
  return (
    <>
      <div className="note" style={{ marginBottom: 14 }}>
        <i className="fa-solid fa-circle-info" style={{ color: "var(--red)" }} />{" "}
        {contasDoPlano.length
          ? t("Clientes neste plano ({0}): ").replace("{0}", plano) + contasDoPlano.join(", ")
          : t("Nenhum cliente usa o plano {0}: estas escolhas ainda não escondem nada a ninguém.").replace("{0}", plano)}
        <br />
        {temPorGravar ? (
          <small>
            <b>{t("Alterações por gravar")}</b> ({planosPorGravar.join(", ")}) — {t("carregue em Guardar alterações, no fundo da página.")}
          </small>
        ) : (
          <small style={{ color: "var(--muted)" }}>
            {t("Escolha o que os clientes deste plano vêem e carregue em Guardar alterações, no fundo da página.")}
          </small>
        )}
      </div>
      <div>
        <div>
          {grupos.map(([g, itens]) => (
            <Frm
              key={g}
              className="acessos-grupo"
              title={g}
              desc={t("Assinale o que os clientes deste plano vêem")}
              right={
                <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                  <Check
                    checked={itens.some((it) => !escondidos.includes(it.id))}
                    onChange={(v) =>
                      mudarGrupo(
                        itens.map((it) => it.id),
                        v,
                      )
                    }
                    label="Mostrar o menu"
                  />
                </span>
              }
            >
              <div className="acessos-itens">
                {itens.map((it) => (
                  <Check
                    key={it.id}
                    checked={!escondidos.includes(it.id)}
                    onChange={(v) => mudar(it.id, v)}
                    label={it.t}
                  />
                ))}
              </div>
            </Frm>
          ))}
        </div>
      </div>
      <div className="acoes-topo">
        <button className="btn r" disabled={aGravar || !temPorGravar} onClick={gravar}>
          <i className="fa-solid fa-floppy-disk" />
          {t("Guardar alterações")}
        </button>
      </div>
    </>
  );
}

// Cada plano é um submenu de Admin › Configurações de acesso (/admin/acessos/<plano>); sem plano no endereço, o primeiro
export const acessosPlanos: ScreenFn = (vh: VH) => {
  const planos = Object.keys(vh.s.db.pkgs).filter((p) => p !== "system");
  const plano =
    vh.s.sub[0] && planos.includes(vh.s.sub[0]) ? vh.s.sub[0] : planos[0] || "";
  return {
    title: plano
      ? vh.t("Acessos do plano {0}").replace("{0}", plano)
      : "Acessos por plano",
    desc: vh.t("O que os clientes deste plano vêem na barra lateral"),
    crumbs: plano
      ? [{ t: "Acessos por plano", path: "/admin/acessos" }, { t: plano }]
      : undefined,
    body: <AcessosPlanos key={plano} plano={plano} />,
  };
};
