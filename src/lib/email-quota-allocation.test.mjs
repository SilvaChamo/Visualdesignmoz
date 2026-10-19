import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateEmailQuotas } from './email-quota-allocation.ts';

test('redistribui espaço proporcionalmente sem deixar caixas acima de 80%', () => {
  const result = allocateEmailQuotas({
    storageGb: 10,
    targetDomain: 'exemplo.co.mz',
    targetUser: 'principal',
    requestedQuota: '2048',
    mailboxes: [
      { domain: 'exemplo.co.mz', user: 'principal', usedMb: 512, quota: 'unlimited' },
      { domain: 'exemplo.co.mz', user: 'leve', usedMb: 128, quota: 'unlimited' },
      { domain: 'exemplo.co.mz', user: 'activa', usedMb: 1024, quota: 'unlimited' },
    ],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const quotas = new Map(result.changes.map((change) => [change.user, Number(change.newQuota)]));
  const soma = 2048 + [...quotas.values()].reduce((total, quota) => total + quota, 0);
  assert.equal(soma, 10 * 1024);
  assert.ok(Number(quotas.get('leve')) >= Math.ceil(128 / 0.8));
  assert.ok(Number(quotas.get('activa')) >= Math.ceil(1024 / 0.8));
});

test('atribui a uma caixa sem limite o espaço restante após proteger as outras', () => {
  const result = allocateEmailQuotas({
    storageGb: 1,
    targetDomain: 'exemplo.co.mz',
    targetUser: 'principal',
    requestedQuota: 'unlimited',
    mailboxes: [
      { domain: 'exemplo.co.mz', user: 'principal', usedMb: 100, quota: 'unlimited' },
      { domain: 'exemplo.co.mz', user: 'leve', usedMb: 200, quota: 'unlimited' },
    ],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.targetQuota, String(1024 - Math.ceil(200 / 0.8)));
  assert.equal(result.changes[0].newQuota, String(Math.ceil(200 / 0.8)));
});

test('recusa reduzir uma caixa abaixo do que já usa', () => {
  const result = allocateEmailQuotas({
    storageGb: 1,
    targetDomain: 'exemplo.co.mz',
    targetUser: 'principal',
    requestedQuota: '100',
    mailboxes: [{ domain: 'exemplo.co.mz', user: 'principal', usedMb: 200, quota: '500' }],
  });

  assert.equal(result.ok, false);
});

test('recusa quando não há espaço para proteger as outras caixas', () => {
  const result = allocateEmailQuotas({
    storageGb: 1,
    targetDomain: 'exemplo.co.mz',
    targetUser: 'principal',
    requestedQuota: '800',
    mailboxes: [
      { domain: 'exemplo.co.mz', user: 'principal', usedMb: 0, quota: '500' },
      { domain: 'exemplo.co.mz', user: 'activa', usedMb: 400, quota: 'unlimited' },
    ],
  });

  assert.equal(result.ok, false);
});
