import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers/testServer.js';
import { request, loginTestUser } from './helpers/api.js';
import { createTestStudent, deleteTestStudent } from './helpers/fixtures.js';

let ctx;
let token;

before(async () => {
  ctx = await startTestServer();
  token = await loginTestUser(ctx.baseUrl);
});

after(async () => {
  await ctx.close();
});

test('Casos 5, 6 y 7: regenerar QR invalida la versión anterior y valida la nueva', async () => {
  const student = await createTestStudent('qr-flow');
  try {
    const payRes = await request(ctx.baseUrl, '/api/payments', {
      method: 'POST',
      token,
      body: { studentId: student.id, montoCuota: 50, cantidadPlatosExtra: 0, metodoPago: 'EFECTIVO' },
    });
    const accountId = payRes.json.data.account_id;
    const oldToken = payRes.json.data.qr.token;
    assert.equal(payRes.json.data.qr.version, 1);

    // Caso 5: regenerar
    const regenRes = await request(ctx.baseUrl, `/api/qr/${accountId}/regenerate`, { method: 'POST', token });
    assert.equal(regenRes.status, 200);
    assert.equal(regenRes.json.data.qr.version, 2);
    const newToken = regenRes.json.data.qr.qr_token;

    // Caso 6: escanear el QR viejo -> inválido
    const oldValidation = await request(ctx.baseUrl, '/api/qr/validate', { method: 'POST', token, body: { token: oldToken } });
    assert.equal(oldValidation.status, 200);
    assert.equal(oldValidation.json.data.es_valido, false);

    // Caso 7: escanear el QR vigente -> válido
    const newValidation = await request(ctx.baseUrl, '/api/qr/validate', { method: 'POST', token, body: { token: newToken } });
    assert.equal(newValidation.status, 200);
    assert.equal(newValidation.json.data.es_valido, true);

    // Historial: 2 versiones, solo la nueva activa
    const history = await request(ctx.baseUrl, `/api/qr/${accountId}/history`, { token });
    assert.equal(history.json.data.history.length, 2);
    assert.equal(history.json.data.history.find((h) => h.version === 1).activo, false);
    assert.equal(history.json.data.history.find((h) => h.version === 2).activo, true);
  } finally {
    await deleteTestStudent(student.id);
  }
});

test('accountId con formato inválido responde 400', async () => {
  const { status } = await request(ctx.baseUrl, '/api/qr/no-es-uuid/current', { token });
  assert.equal(status, 400);
});

test('GET /api/qr/:accountId/current de una cuenta inexistente responde 404', async () => {
  const { status } = await request(ctx.baseUrl, '/api/qr/00000000-0000-0000-0000-000000000000/current', { token });
  assert.equal(status, 404);
});

test('POST /api/qr/validate con token no-UUID responde 422', async () => {
  const { status } = await request(ctx.baseUrl, '/api/qr/validate', { method: 'POST', token, body: { token: 'abc' } });
  assert.equal(status, 422);
});

test('POST /api/qr/validate sin JWT responde 401', async () => {
  const { status } = await request(ctx.baseUrl, '/api/qr/validate', {
    method: 'POST',
    body: { token: '00000000-0000-0000-0000-000000000000' },
  });
  assert.equal(status, 401);
});
