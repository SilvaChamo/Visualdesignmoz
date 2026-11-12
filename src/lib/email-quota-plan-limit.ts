// Limite do espaço das caixas de e-mail nos planos de alojamento (Silva, 12/11/2026: no painel da RevistaTerra as quotas das 7 caixas
// somavam 26 GB e o plano Profissional tem 20 GB, e o painel ainda aceitava mais).
//
// Os planos de e-mail (Básico, Premium, Enterprise) já têm a sua regra em `email-quota-allocation.ts` (redistribui as quotas pelas caixas).
// Aqui está a dos planos de alojamento (vhost-basico, vhost-pro…): as quotas de TODAS as caixas da conta, em todos os domínios, não
// podem somar mais do que METADE do espaço do plano; a outra metade fica para o site (Silva, 12/11/2026: «se os e-mails ocupam todas as
// quotas do plano, o que vai sobrar para o site?»). Quem sobe uma quota só pode subir até ao que ainda sobra; baixar é sempre permitido
// (assim uma conta que já passou do limite corrige-se caixa a caixa). Funções puras: servem a rota (`/api/vhost/email`), o ecrã das
// contas de e-mail e o teste (`email-quota-plan-limit.test.mjs`).

export interface CaixaQuota {
  domain: string;
  user: string;
  /** espaço que a caixa já usa, em MB */
  usedMb: number;
  /** quota em MB; null = sem limite */
  quotaMb: number | null;
}

/**
 * O espaço do plano, em MB, para somar as quotas das caixas. O pacote do servidor guarda o espaço em MB e os de alojamento
 * dizem «20 GB» como 20000 (decimal), mas o painel mostra as quotas em GB de 1024 MB (1 GB = 1024 MB): sem isto, um plano de
 * 20 GB deixaria 19,53 GB. Se o valor é redondo em milhares (e não em 1024), é o GB do plano: 20000 → 20480.
 * `null`, vazio ou 0 = o plano não tem limite de espaço (admin, revenda ilimitada…): não se limita nada.
 */
export function limiteQuotasDoPlanoMb(discoMb: number | null | undefined): number | null {
  if (typeof discoMb !== 'number' || !Number.isFinite(discoMb) || discoMb <= 0) return null;
  const mb = Math.round(discoMb);
  return mb % 1000 === 0 && mb % 1024 !== 0 ? (mb / 1000) * 1024 : mb;
}

/** Parte do espaço do plano de alojamento que as quotas das caixas de e-mail podem somar; o resto fica para o site. Os planos só de
 *  e-mail não passam por aqui: nesses o espaço todo é das caixas (`email-quota-allocation.ts`). */
export const PARTE_DO_PLANO_PARA_CAIXAS = 0.5;

/** O que as quotas das caixas podem somar, em MB, num plano de alojamento: metade do espaço do plano (20 GB → 10 GB). `null` = sem limite. */
export function limiteQuotasDasCaixasMb(discoMb: number | null | undefined): number | null {
  const plano = limiteQuotasDoPlanoMb(discoMb);
  return plano === null ? null : Math.floor(plano * PARTE_DO_PLANO_PARA_CAIXAS);
}

/** O que a caixa já tem «reservado» no plano: a quota; numa caixa sem limite, só o que usa (não se sabe mais). */
const reservadoMb = (c: CaixaQuota): number => (c.quotaMb !== null ? c.quotaMb : Number.isFinite(c.usedMb) ? Math.max(0, Math.ceil(c.usedMb)) : 0);

/** Quanto sobra do plano para esta caixa: o limite menos o que as OUTRAS caixas da conta já reservam (nunca abaixo de 0). */
export function espacoDisponivelMb(caixas: CaixaQuota[], domain: string, user: string, limiteMb: number): number {
  const outras = caixas.filter((c) => !(c.domain === domain && c.user === user));
  return Math.max(0, limiteMb - outras.reduce((soma, c) => soma + reservadoMb(c), 0));
}

export type SomaQuotas = { ok: true; quotaMb: number | null } | { ok: false; erro: string };

/**
 * Confere (e, se for preciso, ajusta) a quota pedida para uma caixa.
 *  - sem limite no plano (`limiteMb` null) → passa como veio;
 *  - quota igual à que a caixa já tem → passa (mexer só noutra coisa, como o limite de envios, nunca falha por isto);
 *  - número: passa se cabe no que sobra do plano, ou se é para baixar; senão recusa com o espaço que ainda há;
 *  - «sem limite» pedido (null) numa caixa que não o era: fica com tudo o que sobra (como nos planos de e-mail); se não sobra nada, recusa.
 */
export function verificarSomaQuotas(p: {
  caixas: CaixaQuota[];
  domain: string;
  user: string;
  /** quota pedida em MB; null = sem limite */
  pedidaMb: number | null;
  limiteMb: number | null;
  /** a caixa ainda não existe */
  criar?: boolean;
}): SomaQuotas {
  const { caixas, domain, user, pedidaMb, limiteMb, criar = false } = p;
  if (limiteMb === null) return { ok: true, quotaMb: pedidaMb };
  const actual = criar ? undefined : caixas.find((c) => c.domain === domain && c.user === user);
  if (actual && actual.quotaMb === pedidaMb) return { ok: true, quotaMb: pedidaMb };
  const disponivel = espacoDisponivelMb(caixas, domain, user, limiteMb);
  const recusa = (): SomaQuotas => ({
    ok: false,
    erro: `As caixas de e-mail podem ocupar no máximo ${Math.max(1, Math.round(limiteMb / 1024))} GB neste plano (o resto do espaço fica para o site). Disponível para esta caixa: ${disponivel} MB.`,
  });
  if (pedidaMb === null) return disponivel > 0 ? { ok: true, quotaMb: disponivel } : recusa();
  if (pedidaMb <= disponivel) return { ok: true, quotaMb: pedidaMb };
  if (actual && actual.quotaMb !== null && pedidaMb <= actual.quotaMb) return { ok: true, quotaMb: pedidaMb };
  return recusa();
}
