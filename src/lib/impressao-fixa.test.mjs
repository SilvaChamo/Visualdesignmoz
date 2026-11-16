import test from 'node:test';
import assert from 'node:assert/strict';
import { PREPARACAO_IMPRESSAO, impressaoUnitariaFixa } from './impressao-fixa.ts';

test('a preparação fixa de 460 reparte-se pelas unidades: 100 camisas dão 4,6 cada', () => {
  assert.equal(PREPARACAO_IMPRESSAO, 460);
  assert.equal(impressaoUnitariaFixa(100), '4.6');
  assert.equal(impressaoUnitariaFixa(20), '23');
  assert.equal(impressaoUnitariaFixa(25), '18.4');
  assert.equal(impressaoUnitariaFixa(10), '46');
});

test('sem unidades válidas o custo unitário é 0 e o total volta a 460 ao multiplicar', () => {
  assert.equal(impressaoUnitariaFixa(0), '0');
  assert.equal(impressaoUnitariaFixa(-5), '0');
  for (const u of [3, 7, 2034]) assert.ok(Math.abs(Number(impressaoUnitariaFixa(u)) * u - 460) < 1e-5);
});
