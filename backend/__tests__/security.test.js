const test = require('node:test');
const assert = require('node:assert/strict');
const { isSameOriginRequest, csrfProtection } = require('../security');

function createRequest({ method = 'POST', origin, referer, protocol = 'https', host = 'conecta.test' } = {}) {
  const headers = { origin, referer, host };
  return {
    method,
    protocol,
    get(name) {
      return headers[name.toLowerCase()];
    }
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('aceita solicitação da mesma origem', () => {
  assert.equal(isSameOriginRequest(createRequest({ origin: 'https://conecta.test' })), true);
});

test('rejeita solicitação de outra origem', () => {
  assert.equal(isSameOriginRequest(createRequest({ origin: 'https://site-malicioso.test' })), false);
});

test('usa Referer quando Origin não está presente', () => {
  assert.equal(isSameOriginRequest(createRequest({ referer: 'https://conecta.test/paginas/login.html' })), true);
});

test('rejeita solicitação sem Origin e sem Referer', () => {
  assert.equal(isSameOriginRequest(createRequest()), false);
});

test('permite métodos seguros sem exigir origem', () => {
  let called = false;
  const response = createResponse();
  csrfProtection(createRequest({ method: 'GET' }), response, () => { called = true; });
  assert.equal(called, true);
  assert.equal(response.statusCode, 200);
});

test('bloqueia POST sem origem confiável', () => {
  let called = false;
  const response = createResponse();
  csrfProtection(createRequest(), response, () => { called = true; });
  assert.equal(called, false);
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.erro.includes('proteção de segurança'), true);
});
