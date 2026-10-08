export type EmailBillingCycle = 'monthly' | 'semiannual' | 'annual';

export interface EmailPlanDef {
  id: 'email-basico' | 'email-premium' | 'email-enterprise';
  /** Nome do plano no cartão (Básico/Premium/Enterprise). */
  label: string;
  /** Caixas de email incluídas — null = ilimitadas. */
  accounts: number | null;
  storageGb: number;
  /** Preço anual em MT; mensal e semestral são a divisão deste valor. */
  annualPrice: number;
  /** Pacote no Hestia (Contabo) com os mesmos limites. */
  hestiaPackage: string;
  popular: boolean;
}

/**
 * Fonte única dos planos de email (pedido do utilizador, 8 out 2026). Usada
 * por /precos/email, pelo carrinho, pela validação de preço no servidor
 * (package-catalog) e pela criação da conta no servidor (email-plan-provision).
 */
export const EMAIL_PLANS: EmailPlanDef[] = [
  { id: 'email-basico', label: 'Básico', accounts: 5, storageGb: 10, annualPrice: 3080, hestiaPackage: 'VD-Email-Basico', popular: false },
  { id: 'email-premium', label: 'Premium', accounts: 10, storageGb: 25, annualPrice: 4200, hestiaPackage: 'VD-Email-Premium', popular: true },
  { id: 'email-enterprise', label: 'Enterprise', accounts: null, storageGb: 50, annualPrice: 6528, hestiaPackage: 'VD-Email-Enterprise', popular: false },
];

export const EMAIL_CYCLE_MONTHS: Record<EmailBillingCycle, number> = { monthly: 1, semiannual: 6, annual: 12 };
export const EMAIL_CYCLE_LABELS: Record<EmailBillingCycle, string> = { monthly: 'Mensal', semiannual: 'Semestral', annual: 'Anual' };

export function getEmailPlan(id: string): EmailPlanDef | undefined {
  return EMAIL_PLANS.find((p) => p.id === id);
}

/** Nome do produto (carrinho, facturas, hosting_renewals.package_name). */
export function emailPlanProductName(plan: EmailPlanDef): string {
  return `Email ${plan.label}`;
}

/** Preço do ciclo: o anual dividido pelos meses do ciclo, em MT com cêntimos. */
export function getEmailCyclePrice(plan: EmailPlanDef, cycle: EmailBillingCycle): number {
  return Math.round(((plan.annualPrice * EMAIL_CYCLE_MONTHS[cycle]) / 12) * 100) / 100;
}

export function emailCycleForMonths(months: number): EmailBillingCycle | undefined {
  return (Object.keys(EMAIL_CYCLE_MONTHS) as EmailBillingCycle[]).find((c) => EMAIL_CYCLE_MONTHS[c] === months);
}

/** Plano a partir do nome gravado em hosting_renewals.package_name. Inclui o
 * nome antigo "Email Básico" (era o único plano). */
export function emailPlanByProductName(name: string | null | undefined): EmailPlanDef | undefined {
  const clean = String(name || '').trim().toLowerCase();
  return EMAIL_PLANS.find((p) => emailPlanProductName(p).toLowerCase() === clean);
}

/** true para qualquer plano de email (nome do pacote no espelho/renovações). */
export function isEmailPlanPackage(name: string | null | undefined): boolean {
  return Boolean(emailPlanByProductName(name));
}
