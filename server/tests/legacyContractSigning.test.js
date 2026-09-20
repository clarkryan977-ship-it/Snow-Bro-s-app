const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const { redirectLegacyContractSigningLink } = require('../routes/legacyContractSigning');

async function requestWithDb(db, path) {
  const app = express();
  app.use((req, _res, next) => {
    req.db = db;
    next();
  });
  app.get('/contracts/:id/sign', redirectLegacyContractSigningLink);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    return await fetch(`http://127.0.0.1:${port}${path}`, { redirect: 'manual' });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('redirects a pending legacy link to its existing tokenized URL', async () => {
  const db = {
    query: async (sql, params) => {
      if (sql.startsWith('SELECT')) {
        assert.deepEqual(params, [24]);
        return { rows: [{ id: 24, status: 'pending' }] };
      }
      assert.match(sql, /UPDATE contracts/);
      assert.equal(params[1], 24);
      return { rows: [{ sign_token: 'existing-unpredictable-token' }] };
    },
  };

  const response = await requestWithDb(db, '/contracts/24/sign');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/sign-contract/existing-unpredictable-token');
});

test('creates and redirects to a token for a legacy contract without one', async () => {
  let generatedToken;
  const db = {
    query: async (sql, params) => {
      if (sql.startsWith('SELECT')) return { rows: [{ id: 24, status: 'pending' }] };
      generatedToken = params[0];
      return { rows: [{ sign_token: generatedToken }] };
    },
  };

  const response = await requestWithDb(db, '/contracts/24/sign');
  assert.equal(response.status, 302);
  assert.match(generatedToken, /^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
  assert.equal(response.headers.get('location'), `/sign-contract/${generatedToken}`);
});

test('does not expose a signing flow for missing, malformed, or completed contracts', async () => {
  const missingDb = { query: async () => ({ rows: [] }) };
  const missing = await requestWithDb(missingDb, '/contracts/99999/sign');
  assert.equal(missing.status, 404);

  const malformedDb = { query: async () => { throw new Error('database should not be called'); } };
  const malformed = await requestWithDb(malformedDb, '/contracts/not-a-number/sign');
  assert.equal(malformed.status, 404);

  const signedDb = { query: async () => ({ rows: [{ id: 24, status: 'signed' }] }) };
  const signed = await requestWithDb(signedDb, '/contracts/24/sign');
  assert.equal(signed.status, 409);
});
