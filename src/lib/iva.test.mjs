import test from 'node:test';
import assert from 'node:assert/strict';
import { separarIvaIncluido, acrescentarIva, decomporCompra } from './iva.ts';

test('IVA incluído: sem IVA + IVA dá sempre o total', () => {
  for (const total of [1, 99, 1160, 1234.56, 99999.99]) {
    const r = separarIvaIncluido(total);
    assert.equal(Math.round((r.semIvaMt + r.ivaMt) * 100) / 100, r.totalMt);
  }
});

test('IVA incluído: 1160 MT = 1000 sem IVA + 160 de IVA', () => {
  assert.deepEqual(separarIvaIncluido(1160), { semIvaMt: 1000, ivaMt: 160, totalMt: 1160 });
});

test('IVA acrescentado: 1000 MT + 16 % = 1160 MT', () => {
  assert.deepEqual(acrescentarIva(1000), { subtotalMt: 1000, ivaMt: 160, totalMt: 1160 });
});

test('Recibo: reconhece compra nova (IVA acrescentado) e antiga (IVA incluído)', () => {
  assert.deepEqual(decomporCompra(1000, 1160), { acrescentado: true, semIvaMt: 1000, ivaMt: 160, totalMt: 1160 });
  assert.deepEqual(decomporCompra(1160, 1160), { acrescentado: false, semIvaMt: 1000, ivaMt: 160, totalMt: 1160 });
});
