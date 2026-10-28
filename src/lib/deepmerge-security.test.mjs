import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const deepmerge = require('deepmerge');

test('deepmerge does not copy prototype-mutating keys from source or target', () => {
  const source = JSON.parse('{"__proto__":{"isAdmin":true},"constructor":{"isAdmin":true},"prototype":{"isAdmin":true}}');
  const target = JSON.parse('{"__proto__":{"isAdmin":true}}');
  const mergedFromNullPrototype = deepmerge(Object.create(null), source);
  const mergedFromOwnProperty = deepmerge(target, {});

  for (const merged of [mergedFromNullPrototype, mergedFromOwnProperty]) {
    assert.equal(Object.getPrototypeOf(merged), Object.prototype);
    assert.equal(merged.isAdmin, undefined);
    assert.equal(Object.hasOwn(merged, '__proto__'), false);
    assert.equal(Object.hasOwn(merged, 'constructor'), false);
    assert.equal(Object.hasOwn(merged, 'prototype'), false);
  }
});

test('deepmerge still merges ordinary properties and arrays', () => {
  assert.deepEqual(deepmerge({ nested: { first: true }, list: [1] }, { nested: { second: true }, list: [2] }), {
    nested: { first: true, second: true },
    list: [1, 2],
  });
});
