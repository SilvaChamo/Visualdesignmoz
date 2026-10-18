export type EmailQuotaMailbox = {
  domain: string;
  user: string;
  usedMb: number;
  quota: string;
};

export type EmailQuotaChange = {
  domain: string;
  user: string;
  previousQuota: string;
  newQuota: string;
};

export type EmailQuotaAllocation =
  | { ok: true; targetQuota: string; changes: EmailQuotaChange[] }
  | { ok: false; error: string };

export function allocateEmailQuotas(params: {
  mailboxes: EmailQuotaMailbox[];
  targetDomain: string;
  targetUser: string;
  requestedQuota: string;
  storageGb: number;
  creating?: boolean;
}): EmailQuotaAllocation {
  const { mailboxes, targetDomain, targetUser, requestedQuota, storageGb, creating = false } = params;
  const maxStorageMb = storageGb * 1024;
  const target = mailboxes.find((mailbox) => mailbox.domain === targetDomain && mailbox.user === targetUser);
  if (!creating && !target) {
    return { ok: false, error: 'Não foi possível encontrar a utilização actual da caixa.' };
  }
  if (target && requestedQuota !== 'unlimited' && target.quota === requestedQuota) {
    return { ok: true, targetQuota: target.quota, changes: [] };
  }
  if (mailboxes.some((mailbox) => !Number.isSafeInteger(mailbox.usedMb) || mailbox.usedMb < 0)) {
    return { ok: false, error: 'Não foi possível ler a utilização de todas as caixas; nenhuma quota foi alterada.' };
  }
  const targetUsedMb = target?.usedMb || 0;
  const others = mailboxes.filter((mailbox) => mailbox !== target);
  const minimumQuotas = others.map((mailbox) => Math.max(1, Math.ceil(mailbox.usedMb / 0.8)));
  const minimumOthersMb = minimumQuotas.reduce((total, quota) => total + quota, 0);
  const targetQuotaMb = requestedQuota === 'unlimited' ? maxStorageMb - minimumOthersMb : Number(requestedQuota);

  if (!Number.isSafeInteger(targetQuotaMb) || targetQuotaMb < targetUsedMb || targetQuotaMb > maxStorageMb) {
    return { ok: false, error: `A quota pedida não é compatível com o espaço usado e o limite de ${storageGb} GB do plano.` };
  }
  const remainingMb = maxStorageMb - targetQuotaMb - minimumOthersMb;
  if (remainingMb < 0) {
    return { ok: false, error: `Não há espaço suficiente para aumentar esta caixa e manter as outras abaixo de 80% de utilização no plano de ${storageGb} GB.` };
  }

  const averageUsageMb = others.length ? others.reduce((total, mailbox) => total + mailbox.usedMb, 0) / others.length : 0;
  const weights = others.map((mailbox) => Math.max(1, mailbox.usedMb, averageUsageMb));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const allocated = minimumQuotas.map((minimum, index) => minimum + (totalWeight ? Math.floor(remainingMb * weights[index] / totalWeight) : 0));
  let undistributedMb = maxStorageMb - targetQuotaMb - allocated.reduce((total, quota) => total + quota, 0);

  if (allocated.length) {
    const fractionalParts = weights
      .map((weight, index) => ({ index, fraction: (remainingMb * weight / totalWeight) % 1 }))
      .sort((a, b) => b.fraction - a.fraction);
    for (let index = 0; index < undistributedMb; index++) {
      allocated[fractionalParts[index % fractionalParts.length].index]++;
    }
  } else {
    undistributedMb = 0;
  }

  return {
    ok: true,
    targetQuota: String(targetQuotaMb),
    changes: others
      .map((mailbox, index) => ({
        domain: mailbox.domain,
        user: mailbox.user,
        previousQuota: mailbox.quota,
        newQuota: String(allocated[index]),
      }))
      .filter((change) => change.previousQuota !== change.newQuota),
  };
}
