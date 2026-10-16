"use client";

// Admin › Acessos por plano (pedido do Silva, 15/10/2026): para cada plano, o que os clientes vêem na barra lateral da
// Gestão. Um cliente com um plano de profissional deixava de ver, por ex., a edição de domínios só desligando aqui.
// Guardado no servidor (/api/vhost/acessos); administradores e revendedores vêem sempre tudo.
import { useEffect, useRef, useState } from "react";
import { useVH, type VH } from "../context";
import { MENU } from "../generated/data";
import { isUser } from "../state";
import type { ScreenFn } from "../screens";
import { Check, Frm } from "./componentes";

function AcessosPlanos({ plano }: { plano: string }) {
  const { s, t, toast, setAcessos } = useVH();
  // Cada caixa grava logo no servidor (Silva, 16/10/2026): com o "Guardar" no fundo da página, mudar de plano ou de
  // página sem gravar perdia as escolhas sem aviso — os acessos do VD-Host-Basico nunca chegaram ao servidor.
  const [rascunho, setRascunho] = useState<Record<string, string[]>>(() =>
    structuredClone(s.acessos || {}),
  );
  const ultimo = useRef(rascunho);
  const pedido = useRef(0);
  const [estado, setEstado] = useState<"" | "a-gravar" | "gravado" | "erro">("");
  // os acessos guardados chegam do servidor depois de a página abrir: mostra-os enquanto nada está a gravar
  useEffect(() => {
    if (estado === "a-gravar") return;
    const n = structuredClone(s.acessos || {});
    ultimo.current = n;
    setRascunho(n);
  }, [s.acessos]); // eslint-disable-line react-hooks/exhaustive-deps
  const escondidos = rascunho[plano] || [];
  const gravar = async (novo: Record<string, string[]>) => {
    const n = ++pedido.current;
    setEstado("a-gravar");
    try {
      const r = await fetch("/api/vhost/acessos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acessos: novo }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        erro?: string;
        acessos?: Record<string, string[]>;
      };
      // só a resposta do último clique conta (cliques seguidos: as respostas podem chegar fora de ordem)
      if (n !== pedido.current) return;
      if (!r.ok) {
        setEstado("erro");
        return toast(j.erro || "Não foi possível gravar");
      }
      setEstado("gravado");
      setAcessos(j.acessos || novo);
    } catch {
      if (n !== pedido.current) return;
      setEstado("erro");
      toast("Sem ligação ao site. Nada foi gravado.");
    }
  };
  const aplicar = (fn: (lista: string[]) => string[]) => {
    const novo = { ...ultimo.current, [plano]: fn(ultimo.current[plano] || []) };
    ultimo.current = novo;
    setRascunho(novo);
    void gravar(novo);
  };
  const mudar = (id: string, ver: boolean) =>
    aplicar((l) => (ver ? l.filter((x) => x !== id) : [...new Set([...l, id])]));
  // o menu pai inteiro: desligar esconde todas as páginas dele (sem nenhuma, a barra lateral nem mostra o menu)
  const mudarGrupo = (ids: string[], ver: boolean) =>
    aplicar((l) => (ver ? l.filter((x) => !ids.includes(x)) : [...new Set([...l, ...ids])]));
  const grupos = MENU.utilizador.filter(([g]) => g !== "Início");
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
        <small style={{ color: "var(--muted)" }}>
          {estado === "a-gravar"
            ? t("A gravar…")
            : estado === "gravado"
              ? t("Gravado. Os clientes deste plano vêem a mudança ao abrir ou recarregar o painel.")
              : estado === "erro"
                ? t("A última mudança não foi gravada. Tente de novo.")
                : t("Cada caixa grava logo, sem botão Guardar.")}
        </small>
      </div>
      <div>
        <div>
          {grupos.map(([g, itens]) => (
            <Frm
              key={g}
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
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: "10px 18px",
                  padding: "14px 18px",
                }}
              >
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
