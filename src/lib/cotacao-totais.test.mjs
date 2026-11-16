import test from 'node:test';
import assert from 'node:assert/strict';
import { totaisDaEncomenda, totalDaLinhaSemIva } from './cotacao-totais.ts';

const r2 = (n) => Math.round(n * 100) / 100;
// a conta de encomendaPaymentSplit (encomenda-checkout.ts), repetida aqui porque esse módulo usa imports com alias
const split = (totalMt) => {
  const ivaMt = r2(totalMt * 0.16);
  return { subtotalMt: totalMt, ivaMt, totalComIvaMt: r2(totalMt + ivaMt) };
};

test('a folha do administrador e a do cliente dão o mesmo total que a factura e o cartão (encomenda real COT 2026/0002)', () => {
  // o que a calculadora autoriza e o servidor grava: preço sem IVA de 2 casas e total_mt = preço × quantidade
  const bd = [
    { precoSemIva: 6573.23, unidades: 1 },
    { precoSemIva: 3988.61, unidades: 1 },
    { precoSemIva: 1850.71, unidades: 1 },
  ];
  const somaTotalMt = r2(bd.reduce((t, l) => t + totalDaLinhaSemIva(l.precoSemIva, l.unidades), 0));
  const folha = totaisDaEncomenda(bd, 16);
  assert.equal(folha.subtotal, 12412.55);
  assert.equal(folha.total, 14398.56);
  assert.deepEqual({ s: folha.subtotal, i: folha.ivaValor, t: folha.total }, { s: somaTotalMt, i: split(somaTotalMt).ivaMt, t: split(somaTotalMt).totalComIvaMt });
});

test('o preço sem IVA com mais de 2 casas (calculadora) dá a mesma folha que o preço de 2 casas guardado (cliente)', () => {
  const quantidades = [400, 2034, 400, 200];
  const precos = [49.794157, 35.97572, 55.793453, 179.978881];
  const admin = totaisDaEncomenda(precos.map((p, k) => ({ precoSemIva: p, unidades: quantidades[k] })), 16);
  const cliente = totaisDaEncomenda(precos.map((p, k) => ({ precoSemIva: r2(p), unidades: quantidades[k] })), 16);
  assert.deepEqual(admin, cliente);
  assert.equal(admin.total, split(admin.subtotal).totalComIvaMt);
});
