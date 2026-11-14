import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG_BRINDES_PADRAO as P, IVA_VENDA_PCT, configValida, valorPorUnidadeMt } from './preco-brindes.ts';
import { calcularCustoImportacao, EXEMPLO_ENTRADA } from './calculadora-custo-importacao.ts';
import { IVA_TAXA } from './iva.ts';

// o mesmo produto (1 unidade) na calculadora: o frete, o seguro e as despesas são a fracção `Ratio` do custo (a repartição por valor de uma remessa
// em que todos os produtos levam a mesma fracção), e o IVA da venda soma-se por cima do preço com margem
function naCalculadora(precoZar, taxa, c) {
  const custo = precoZar * taxa * (1 + c.erroPct / 100);
  const r = calcularCustoImportacao({
    ...EXEMPLO_ENTRADA,
    base: c.base,
    frete: custo * c.freteRatio,
    seguro: custo * c.seguroRatio,
    corretor: 0, porto: 0, entrega: 0, entregaDomicilio: 0, outros: custo * c.partilhadosRatio, comissao: 0,
    alfandega: custo * c.alfandegaRatio,
    lucro: custo * c.lucroRatio,
    perdasPct: 0,
    margemPct: c.margemPct,
    impostoPct: c.impostoPct,
    impostoSobreDireitos: c.impostoSobreDireitos,
    impostoSobreFrete: c.impostoSobreFrete,
    recuperavel: c.recuperavel,
    linhas: [{ nome: 'x', unidades: 1, custo, direitos: c.direitosPct, peso: 0, volume: 0 }],
  });
  assert.equal(r.ok, true);
  return r.linhas[0].preco * (1 + IVA_VENDA_PCT / 100);
}

test('o valor dos brindes dá o mesmo que a calculadora, com ou sem custos da remessa', () => {
  const configs = [
    P,
    { ...P, base: 'cfr', freteRatio: 0.12, seguroRatio: 0.01, partilhadosRatio: 0.05, direitosPct: 20, erroPct: 10, recuperavel: true },
    { ...P, base: 'cif', freteRatio: 0.12, seguroRatio: 0.01, partilhadosRatio: 0.05, direitosPct: 20, erroPct: 5, recuperavel: false },
    { ...P, base: 'cfr', freteRatio: 0.1, seguroRatio: 0, partilhadosRatio: 0.03, alfandegaRatio: 0.15, lucroRatio: 0.4, erroPct: 10, recuperavel: true },
    { ...P, base: 'cif', freteRatio: 0.1, seguroRatio: 0.01, partilhadosRatio: 0.03, alfandegaRatio: 0.15, lucroRatio: 0, recuperavel: false },
    { ...P, base: 'fob', freteRatio: 0.2, seguroRatio: 0.02, partilhadosRatio: 0, direitosPct: 7.5, recuperavel: false, impostoSobreFrete: false, impostoSobreDireitos: false },
  ];
  for (const c of configs) for (const [precoZar, taxa] of [[5.8, 3.6], [28, 3.55], [70, 3.7], [0.5, 3.6]]) {
    assert.ok(Math.abs(valorPorUnidadeMt(precoZar, taxa, c) - naCalculadora(precoZar, taxa, c)) < 1e-9, `${JSON.stringify(c)} ${precoZar}`);
  }
});

test('sem nada definido o valor é o câmbio com a margem e o IVA; cada custo da remessa sobe-o', () => {
  assert.equal(IVA_VENDA_PCT / 100, IVA_TAXA);
  const base = valorPorUnidadeMt(10, 3.6);
  assert.ok(Math.abs(base - 36 / (1 - P.margemPct / 100) * 1.16) < 1e-9);
  assert.ok(valorPorUnidadeMt(10, 3.6, { ...P, freteRatio: 0.1 }) > base);
  assert.ok(valorPorUnidadeMt(10, 3.6, { ...P, partilhadosRatio: 0.1 }) > base);
  assert.ok(valorPorUnidadeMt(10, 3.6, { ...P, alfandegaRatio: 0.1 }) > base);
  assert.ok(valorPorUnidadeMt(10, 3.6, { ...P, lucroRatio: 1.2 }) > base);
});

test('configValida recusa valores inválidos e aceita os de partida', () => {
  assert.deepEqual(configValida(P), P);
  const { alfandegaRatio, lucroRatio, ...antiga } = P; // o que se guardou antes dos dois campos novos
  assert.deepEqual(configValida(antiga), P);
  assert.equal(configValida({ ...P, margemPct: 100 }), null);
  assert.equal(configValida({ ...P, freteRatio: -1 }), null);
  assert.equal(configValida({ ...P, base: 'xxx' }), null);
  assert.equal(configValida(null), null);
});
