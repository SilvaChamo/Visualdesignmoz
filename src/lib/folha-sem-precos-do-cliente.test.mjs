import test from 'node:test';
import assert from 'node:assert/strict';
import { semPrecosDoCliente } from './folha-sem-precos-do-cliente.ts';

test('o preço escrito pelo cliente é descartado; o que a equipa já tinha mantém-se', () => {
  const novo = { edicoes: { 1: { preco: '1', unidades: '300' }, 2: { preco: '2', nome: 'x' } }, cliente: 'A' };
  const antigo = { edicoes: { 2: { preco: '99' } } };
  assert.deepEqual(semPrecosDoCliente(novo, antigo), { edicoes: { 1: { unidades: '300' }, 2: { nome: 'x', preco: '99' } }, cliente: 'A' });
  assert.deepEqual(semPrecosDoCliente({ cliente: 'A' }, null), { cliente: 'A' });
});
