import assert from 'node:assert/strict';
import test from 'node:test';
import { PARTE_DO_PLANO_PARA_CAIXAS, espacoDisponivelMb, limiteQuotasDasCaixasMb, limiteQuotasDoPlanoMb, verificarSomaQuotas } from './email-quota-plan-limit.ts';

// A conta RevistaTerra tal como estava no painel (12/11/2026): 6 caixas de 1 GB e a «redaccao» com 20 GB = 26 GB de quotas num plano de 20 GB.
// As caixas só podem ficar com METADE do plano (10 GB); a outra metade é do site.
const D = 'revistaterra.co.mz';
const caixa = (user, usedMb, quotaMb, domain = D) => ({ domain, user, usedMb, quotaMb });
const conta = (redaccaoMb = 20480) => [
  caixa('admin', 6, 1024),
  caixa('info', 1, 1024),
  caixa('administracao', 3, 1024),
  caixa('admistracao', 1, 1024),
  caixa('editor', 602, 1024),
  caixa('comercial', 98, 1024),
  caixa('redaccao', 1002, redaccaoMb),
];
const LIMITE = limiteQuotasDasCaixasMb(20000); // o Profissional: o servidor diz 20000 MB → 20 GB → as caixas ficam com 10 GB
const GERAL = 20480; // um limite qualquer, para os testes que não dependem do plano
const MENSAGEM = /^As caixas de e-mail podem ocupar no máximo (\d+) GB neste plano \(o resto do espaço fica para o site\)\. Disponível para esta caixa: (\d+) MB\.$/;

test('o espaço do plano: 20000 MB do pacote são os 20 GB do plano (20480 MB)', () => {
  assert.equal(limiteQuotasDoPlanoMb(20000), 20480);
  assert.equal(limiteQuotasDoPlanoMb(10000), 10240);
  assert.equal(limiteQuotasDoPlanoMb(20480), 20480);
  assert.equal(limiteQuotasDoPlanoMb(5120), 5120);
});

test('as caixas ficam com metade do plano; a outra metade é do site', () => {
  assert.equal(PARTE_DO_PLANO_PARA_CAIXAS, 0.5);
  assert.equal(LIMITE, 10240); // Profissional: 20 GB → 10 GB para e-mail
  assert.equal(limiteQuotasDasCaixasMb(10000), 5120); // Básico: 10 GB → 5 GB
  assert.equal(limiteQuotasDasCaixasMb(30000), 15360); // Business: 30 GB → 15 GB
  assert.equal(limiteQuotasDasCaixasMb(20480), 10240);
  assert.equal(limiteQuotasDasCaixasMb(1), 0); // espaço minúsculo nunca dá número negativo nem fraccionário
});

test('sem limite de espaço no plano (ilimitado, vazio, 0, lixo) não se limita nada', () => {
  for (const v of [null, undefined, 0, -5, NaN, Infinity]) {
    assert.equal(limiteQuotasDoPlanoMb(v), null);
    assert.equal(limiteQuotasDasCaixasMb(v), null);
  }
  const r = verificarSomaQuotas({ caixas: conta(), domain: D, user: 'info', pedidaMb: 999999, limiteMb: null });
  assert.deepEqual(r, { ok: true, quotaMb: 999999 });
});

test('o caso da imagem: 26 GB de quotas num plano de 20 GB; subir uma caixa de 1 GB para 2 GB é recusado e o aviso diz 10 GB', () => {
  const r = verificarSomaQuotas({ caixas: conta(), domain: D, user: 'info', pedidaMb: 2048, limiteMb: LIMITE });
  assert.equal(r.ok, false);
  assert.match(r.erro, MENSAGEM);
  const [, gb, livre] = r.erro.match(MENSAGEM);
  assert.equal(gb, '10');
  assert.equal(livre, '0');
});

test('criar uma caixa nova nessa conta também é recusado (não sobra espaço)', () => {
  const r = verificarSomaQuotas({ caixas: conta(), domain: D, user: 'nova', pedidaMb: 1024, limiteMb: LIMITE, criar: true });
  assert.equal(r.ok, false);
  assert.match(r.erro, /Disponível para esta caixa: 0 MB\./);
});

test('baixar uma quota é sempre permitido, mesmo com a conta acima do limite; e liberta espaço para as outras', () => {
  // a «redaccao» de 20 GB desce para 10 GB: continua acima do limite (16 GB de quotas), mas baixar nunca é recusado
  assert.deepEqual(verificarSomaQuotas({ caixas: conta(), domain: D, user: 'redaccao', pedidaMb: 10240, limiteMb: LIMITE }), { ok: true, quotaMb: 10240 });
  // com a «redaccao» a 4 GB, as quotas somam 10 GB (o limite): não sobra nada
  assert.equal(espacoDisponivelMb(conta(4096), D, 'nova', LIMITE), 0);
  // com a «redaccao» a 2 GB, as quotas somam 8 GB: sobram 2 GB para uma caixa nova
  const depois = conta(2048);
  assert.equal(espacoDisponivelMb(depois, D, 'nova', LIMITE), 2048);
  assert.deepEqual(verificarSomaQuotas({ caixas: depois, domain: D, user: 'nova', pedidaMb: 2048, limiteMb: LIMITE, criar: true }), { ok: true, quotaMb: 2048 });
  const demais = verificarSomaQuotas({ caixas: depois, domain: D, user: 'nova', pedidaMb: 2049, limiteMb: LIMITE, criar: true });
  assert.equal(demais.ok, false);
  assert.match(demais.erro, /Disponível para esta caixa: 2048 MB\./);
});

test('subir uma caixa dentro do que sobra passa; um MB a mais não', () => {
  const caixas = conta(2048); // 6 × 1 GB + 2 GB = 8 GB de 10 GB
  // a «info» tem 1 GB e pode ir a 1 GB + 2 GB livres = 3 GB
  assert.deepEqual(verificarSomaQuotas({ caixas, domain: D, user: 'info', pedidaMb: 3072, limiteMb: LIMITE }), { ok: true, quotaMb: 3072 });
  assert.equal(verificarSomaQuotas({ caixas, domain: D, user: 'info', pedidaMb: 3073, limiteMb: LIMITE }).ok, false);
});

test('mexer noutra coisa da caixa (a quota fica igual) nunca falha, mesmo com a conta acima do limite', () => {
  assert.deepEqual(verificarSomaQuotas({ caixas: conta(), domain: D, user: 'redaccao', pedidaMb: 20480, limiteMb: LIMITE }), { ok: true, quotaMb: 20480 });
  assert.deepEqual(verificarSomaQuotas({ caixas: conta(), domain: D, user: 'info', pedidaMb: 1024, limiteMb: LIMITE }), { ok: true, quotaMb: 1024 });
});

test('as caixas de outros domínios da mesma conta contam para o limite', () => {
  const caixas = [caixa('a', 0, 8192), caixa('b', 0, 8192, 'outro.co.mz'), caixa('c', 0, 1024)];
  // 8 GB + 8 GB já reservados nas outras duas caixas: a «c» só pode ir a 4 GB (limite 20 GB)
  assert.equal(espacoDisponivelMb(caixas, D, 'c', GERAL), 4096);
  assert.equal(verificarSomaQuotas({ caixas, domain: D, user: 'c', pedidaMb: 4096, limiteMb: GERAL }).ok, true);
  assert.equal(verificarSomaQuotas({ caixas, domain: D, user: 'c', pedidaMb: 4097, limiteMb: GERAL }).ok, false);
});

test('«sem limite» pedido fica com o que sobra (como nos planos de e-mail); sem sobra, recusa', () => {
  const caixas = [caixa('a', 0, 8192), caixa('b', 0, 1024)];
  assert.deepEqual(verificarSomaQuotas({ caixas, domain: D, user: 'b', pedidaMb: null, limiteMb: GERAL }), { ok: true, quotaMb: 12288 });
  // caixa nova: 20480 − 8192 − 1024 = 11264 MB livres
  assert.deepEqual(verificarSomaQuotas({ caixas, domain: D, user: 'nova', pedidaMb: null, limiteMb: GERAL, criar: true }), { ok: true, quotaMb: GERAL - 8192 - 1024 });
  const cheia = verificarSomaQuotas({ caixas: conta(), domain: D, user: 'nova', pedidaMb: null, limiteMb: LIMITE, criar: true });
  assert.equal(cheia.ok, false);
});

test('uma caixa que já era «sem limite» e continua a sê-lo não é mexida', () => {
  const caixas = [caixa('a', 500, null), caixa('b', 0, 1024)];
  assert.deepEqual(verificarSomaQuotas({ caixas, domain: D, user: 'a', pedidaMb: null, limiteMb: GERAL }), { ok: true, quotaMb: null });
});

test('uma caixa «sem limite» das outras conta pelo que usa', () => {
  const caixas = [caixa('a', 3000, null), caixa('b', 0, 1024)];
  assert.equal(espacoDisponivelMb(caixas, D, 'b', GERAL), GERAL - 3000);
});
