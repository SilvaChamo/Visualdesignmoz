import test from 'node:test';
import assert from 'node:assert/strict';
import { ESTIMATIVA_BRINDES as E, valorPorUnidadeMt, custoFixoPorUnidadeMt } from './preco-brindes.ts';
import { calcularCustoImportacao, EXEMPLO_ENTRADA } from './calculadora-custo-importacao.ts';
import { IVA_TAXA } from './iva.ts';

test('o valor dos brindes dá o mesmo que a calculadora (1 unidade, CFR, IVA da importação recuperável) mais o IVA da venda', () => {
  for (const [precoZar, taxa] of [[5.8, 3.6], [28, 3.55], [70, 3.7], [0.5, 3.6]]) {
    const custo = precoZar * taxa * (1 + E.erroPct / 100);
    const r = calcularCustoImportacao({
      ...EXEMPLO_ENTRADA,
      base: 'cfr',
      frete: (custo * E.transportePct) / 100,
      seguro: 0, corretor: 0, porto: 0, entrega: 0, entregaDomicilio: 0, outros: 0, comissao: 0,
      perdasPct: 0,
      margemPct: E.margemPct,
      impostoPct: E.ivaPct,
      recuperavel: true,
      linhas: [{ nome: 'x', unidades: 1, custo, direitos: E.direitosPct, peso: 0, volume: 0 }],
    });
    assert.equal(r.ok, true);
    const esperado = r.linhas[0].preco * (1 + E.ivaPct / 100);
    assert.ok(Math.abs(valorPorUnidadeMt(precoZar, taxa) - esperado) < 1e-9, `${precoZar} × ${taxa}`);
  }
});

test('o valor é sempre maior do que o preço do fornecedor cambiado, e as constantes batem com o IVA e a margem do projecto', () => {
  assert.ok(valorPorUnidadeMt(10, 3.6) > 36);
  assert.equal(E.ivaPct / 100, IVA_TAXA);
  assert.equal(E.margemPct, EXEMPLO_ENTRADA.margemPct);
});

test('os custos fixos da remessa repartidos por unidade entram no custo antes da margem, como os partilhados da calculadora', () => {
  const c = { frete: 0, seguro: 0, corretor: 3000, porto: 1000, entrega: 0, entregaDom: 0, outros: 0, unidades: 1000 };
  assert.equal(custoFixoPorUnidadeMt(c), 4);
  assert.equal(custoFixoPorUnidadeMt(null), 0);
  assert.equal(custoFixoPorUnidadeMt({ ...c, unidades: 0 }), 0);
  const precoZar = 28, taxa = 3.55;
  const custo = precoZar * taxa * (1 + E.erroPct / 100);
  const r = calcularCustoImportacao({
    ...EXEMPLO_ENTRADA,
    base: 'cfr',
    frete: (custo * E.transportePct) / 100,
    seguro: 0, corretor: 4, porto: 0, entrega: 0, entregaDomicilio: 0, outros: 0, comissao: 0,
    perdasPct: 0, margemPct: E.margemPct, impostoPct: E.ivaPct, recuperavel: true,
    linhas: [{ nome: 'x', unidades: 1, custo, direitos: E.direitosPct, peso: 0, volume: 0 }],
  });
  const esperado = r.linhas[0].preco * (1 + E.ivaPct / 100);
  assert.ok(Math.abs(valorPorUnidadeMt(precoZar, taxa, { ...E, fixoMt: 4 }) - esperado) < 1e-9);
  assert.equal(valorPorUnidadeMt(precoZar, taxa, { ...E, fixoMt: 0 }), valorPorUnidadeMt(precoZar, taxa));
});
