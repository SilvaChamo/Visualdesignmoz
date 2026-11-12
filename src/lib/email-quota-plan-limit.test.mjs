import assert from 'node:assert/strict';
import test from 'node:test';
import { espacoDisponivelMb, limiteQuotasDoPlanoMb, verificarSomaQuotas } from './email-quota-plan-limit.ts';

// A conta RevistaTerra tal como estava no painel (12/11/2026): 6 caixas de 1 GB e a «redaccao» com 20 GB = 26 GB de quotas num plano de 20 GB.
const D = 'revistaterra.co.mz';
const caixa = (user, usedMb, quotaMb, domain = D) => ({ domain, user, usedMb, quotaMb });
const conta = () => [
  caixa('admin', 6, 1024),
  caixa('info', 1, 1024),
  caixa('administracao', 3, 1024),
  caixa('admistracao', 1, 1024),
  caixa('editor', 602, 1024),
  caixa('comercial', 98, 1024),
  caixa('redaccao', 1002, 20480),
];
const PLANO = 20480;
const MENSAGEM = /^A soma das quotas não pode exceder (\d+) GB neste plano\. Disponível para esta caixa: (\d+) MB\.$/;

test('o espaço do plano: 20000 MB do pacote são os 20 GB do plano (20480 MB)', () => {
  assert.equal(limiteQuotasDoPlanoMb(20000), 20480);
  assert.equal(limiteQuotasDoPlanoMb(10000), 10240);
  assert.equal(limiteQuotasDoPlanoMb(20480), 20480);
  assert.equal(limiteQuotasDoPlanoMb(5120), 5120);
});

test('sem limite de espaço no plano (ilimitado, vazio, 0, lixo) não se limita nada', () => {
  for (const v of [null, undefined, 0, -5, NaN, Infinity]) assert.equal(limiteQuotasDoPlanoMb(v), null);
  const r = verificarSomaQuotas({ caixas: conta(), domain: D, user: 'info', pedidaMb: 999999, limiteMb: null });
  assert.deepEqual(r, { ok: true, quotaMb: 999999 });
});

test('o caso da imagem: com 26 GB de quotas num plano de 20 GB, subir uma caixa de 1 GB para 2 GB é recusado', () => {
  const r = verificarSomaQuotas({ caixas: conta(), domain: D, user: 'info', pedidaMb: 2048, limiteMb: PLANO });
  assert.equal(r.ok, false);
  assert.match(r.erro, MENSAGEM);
  const [, gb, livre] = r.erro.match(MENSAGEM);
  assert.equal(gb, '20');
  assert.equal(livre, '0');
});

test('criar uma caixa nova nessa conta também é recusado (não sobra espaço)', () => {
  const r = verificarSomaQuotas({ caixas: conta(), domain: D, user: 'nova', pedidaMb: 1024, limiteMb: PLANO, criar: true });
  assert.equal(r.ok, false);
  assert.match(r.erro, /Disponível para esta caixa: 0 MB\./);
});

test('baixar uma quota é sempre permitido, mesmo com a conta acima do plano; e liberta espaço para as outras', () => {
  const baixar = verificarSomaQuotas({ caixas: conta(), domain: D, user: 'redaccao', pedidaMb: 10240, limiteMb: PLANO });
  assert.deepEqual(baixar, { ok: true, quotaMb: 10240 });
  // com a «redaccao» a 10 GB, as quotas somam 16 GB: sobram 4 GB para uma caixa nova
  const depois = conta().map((c) => (c.user === 'redaccao' ? { ...c, quotaMb: 10240 } : c));
  assert.equal(espacoDisponivelMb(depois, D, 'nova', PLANO), 4096);
  assert.deepEqual(verificarSomaQuotas({ caixas: depois, domain: D, user: 'nova', pedidaMb: 4096, limiteMb: PLANO, criar: true }), { ok: true, quotaMb: 4096 });
  const demais = verificarSomaQuotas({ caixas: depois, domain: D, user: 'nova', pedidaMb: 4097, limiteMb: PLANO, criar: true });
  assert.equal(demais.ok, false);
  assert.match(demais.erro, /Disponível para esta caixa: 4096 MB\./);
});

test('subir uma caixa dentro do que sobra do plano passa; um MB a mais não', () => {
  const caixas = conta().map((c) => (c.user === 'redaccao' ? { ...c, quotaMb: 10240 } : c));
  // as outras 6 caixas (1 GB cada) + a «redaccao» (10 GB) = 16 GB; a «info» pode ir a 1 GB + 4 GB livres = 5 GB
  assert.deepEqual(verificarSomaQuotas({ caixas, domain: D, user: 'info', pedidaMb: 5120, limiteMb: PLANO }), { ok: true, quotaMb: 5120 });
  assert.equal(verificarSomaQuotas({ caixas, domain: D, user: 'info', pedidaMb: 5121, limiteMb: PLANO }).ok, false);
});

test('mexer noutra coisa da caixa (a quota fica igual) nunca falha, mesmo com a conta acima do plano', () => {
  assert.deepEqual(verificarSomaQuotas({ caixas: conta(), domain: D, user: 'redaccao', pedidaMb: 20480, limiteMb: PLANO }), { ok: true, quotaMb: 20480 });
  assert.deepEqual(verificarSomaQuotas({ caixas: conta(), domain: D, user: 'info', pedidaMb: 1024, limiteMb: PLANO }), { ok: true, quotaMb: 1024 });
});

test('as caixas de outros domínios da mesma conta contam para o plano', () => {
  const caixas = [caixa('a', 0, 8192), caixa('b', 0, 8192, 'outro.co.mz'), caixa('c', 0, 1024)];
  // 8 GB + 8 GB já reservados nas outras duas caixas: a «c» só pode ir a 4 GB (limite 20 GB)
  assert.equal(espacoDisponivelMb(caixas, D, 'c', PLANO), 4096);
  assert.equal(verificarSomaQuotas({ caixas, domain: D, user: 'c', pedidaMb: 4096, limiteMb: PLANO }).ok, true);
  assert.equal(verificarSomaQuotas({ caixas, domain: D, user: 'c', pedidaMb: 4097, limiteMb: PLANO }).ok, false);
});

test('«sem limite» pedido fica com o que sobra (como nos planos de e-mail); sem sobra, recusa', () => {
  const caixas = [caixa('a', 0, 8192), caixa('b', 0, 1024)];
  assert.deepEqual(verificarSomaQuotas({ caixas, domain: D, user: 'b', pedidaMb: null, limiteMb: PLANO }), { ok: true, quotaMb: 12288 });
  // caixa nova: 20480 − 8192 − 1024 = 11264 MB livres
  assert.deepEqual(verificarSomaQuotas({ caixas, domain: D, user: 'nova', pedidaMb: null, limiteMb: PLANO, criar: true }), { ok: true, quotaMb: PLANO - 8192 - 1024 });
  const cheia = verificarSomaQuotas({ caixas: conta(), domain: D, user: 'nova', pedidaMb: null, limiteMb: PLANO, criar: true });
  assert.equal(cheia.ok, false);
});

test('uma caixa que já era «sem limite» e continua a sê-lo não é mexida', () => {
  const caixas = [caixa('a', 500, null), caixa('b', 0, 1024)];
  assert.deepEqual(verificarSomaQuotas({ caixas, domain: D, user: 'a', pedidaMb: null, limiteMb: PLANO }), { ok: true, quotaMb: null });
});

test('uma caixa «sem limite» das outras conta pelo que usa', () => {
  const caixas = [caixa('a', 3000, null), caixa('b', 0, 1024)];
  assert.equal(espacoDisponivelMb(caixas, D, 'b', PLANO), PLANO - 3000);
});
