import test from 'node:test';
import assert from 'node:assert/strict';
import { separarIvaIncluido } from './iva.ts';

test('IVA incluído: sem IVA + IVA dá sempre o total', () => {
  for (const total of [1, 99, 1160, 1234.56, 99999.99]) {
    const r = separarIvaIncluido(total);
    assert.equal(Math.round((r.semIvaMt + r.ivaMt) * 100) / 100, r.totalMt);
  }
});

test('IVA incluído: 1160 MT = 1000 sem IVA + 160 de IVA', () => {
  assert.deepEqual(separarIvaIncluido(1160), { semIvaMt: 1000, ivaMt: 160, totalMt: 1160 });
});
