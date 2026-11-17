'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { passwordWithinBcryptLimit, parsePositiveId } = require('../validation');

test('limita senhas ao máximo de 72 bytes usado pelo bcrypt', () => {
  assert.equal(passwordWithinBcryptLimit('a'.repeat(72)), true);
  assert.equal(passwordWithinBcryptLimit('a'.repeat(73)), false);
  assert.equal(passwordWithinBcryptLimit('😀'.repeat(18)), true);
  assert.equal(passwordWithinBcryptLimit('😀'.repeat(19)), false);
  assert.equal(passwordWithinBcryptLimit(null), false);
});

test('aceita somente identificadores decimais positivos e seguros', () => {
  assert.equal(parsePositiveId('42'), 42);
  assert.equal(parsePositiveId(' 0042 '), 42);
  assert.equal(parsePositiveId(42), 42);
  for (const value of ['1e2', '0x10', '-1', '1.5', '', '9007199254740992', null, undefined]) {
    assert.equal(parsePositiveId(value), null);
  }
});
