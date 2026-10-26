/**
 * Estado de um domínio depois de expirar, segundo os prazos da Dynadot (o
 * nosso registador): ~30 dias de período de graça (renova ao preço normal),
 * depois ~30 dias de período de redenção (já saiu do registo, só recuperável
 * pagando uma taxa bem mais cara), e por fim livre para qualquer pessoa
 * registar. Prazos exactos variam por extensão — isto é só um aviso
 * aproximado a partir da data de expiração que temos guardada; o estado real
 * fica sempre na conta da Dynadot.
 */

export type RedemptionInfo = {
  label: string
  hint: string
  className: string
}

export function getDaysRemaining(expirationDate: string): number {
  const exp = new Date(expirationDate)
  const today = new Date()
  const diff = exp.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function getRedemptionInfo(daysRemaining: number): RedemptionInfo | null {
  const daysPastExpiry = -daysRemaining
  if (daysPastExpiry <= 0) return null
  if (daysPastExpiry <= 30) {
    return {
      label: 'Expirado — período de graça',
      hint: `Expirou há ${daysPastExpiry} dias. Ainda pode renovar ao preço normal, mas não demore.`,
      className: 'bg-amber-100 text-amber-700',
    }
  }
  if (daysPastExpiry <= 60) {
    return {
      label: 'Período de redenção — recuperação cara',
      hint: `Expirou há ${daysPastExpiry} dias. Já saiu do registo — só é recuperável pagando uma taxa bem mais alta do que uma renovação normal, directamente no registador.`,
      className: 'bg-orange-100 text-orange-700',
    }
  }
  return {
    label: 'Provavelmente perdido',
    hint: `Expirou há ${daysPastExpiry} dias. Pode já estar livre para qualquer pessoa registar — confirme no registador.`,
    className: 'bg-red-100 text-red-700',
  }
}

export const DYNADOT_ACCOUNT_URL = 'https://www.dynadot.com'
