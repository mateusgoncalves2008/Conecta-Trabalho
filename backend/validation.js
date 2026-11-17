'use strict';

const BCRYPT_MAX_BYTES = 72;

function passwordWithinBcryptLimit(password) {
  return typeof password === 'string' &&
    Buffer.byteLength(password, 'utf8') <= BCRYPT_MAX_BYTES;
}

function parsePositiveId(value) {
  const raw = typeof value === 'string'
    ? value.trim()
    : typeof value === 'number' && Number.isSafeInteger(value)
      ? String(value)
      : '';

  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

module.exports = { BCRYPT_MAX_BYTES, passwordWithinBcryptLimit, parsePositiveId };
