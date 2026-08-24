import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers/testServer.js';
import { request } from './helpers/api.js';
import { createEphemeralAuthUser, deleteEphemeralAuthUser } from './helpers/fixtures.js';

let ctx;

before(async () => {
  ctx = await startTestServer();
});

after(async () => {
  await ctx.close();
});

test('POST /api/auth/login sin body responde 422', async () => {
  const { status, json } = await request(ctx.baseUrl, '/api/auth/login', { method: 'POST', body: {} });
  assert.equal(status, 422);
  assert.equal(json.success, false);
});

test('POST /api/auth/login con credenciales correctas responde 200 con access_token', async () => {
  const { status, json } = await request(ctx.baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email: process.env.TEST_USER_EMAIL, password: process.env.TEST_USER_PASSWORD },
  });
  assert.equal(status, 200);
  assert.ok(json.data.session.access_token);
});

test('POST /api/auth/login con password incorrecta responde 401', async () => {
  const { status, json } = await request(ctx.baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email: process.env.TEST_USER_EMAIL, password: 'password-incorrecta' },
  });
  assert.equal(status, 401);
  assert.equal(json.success, false);
});

test('GET /api/auth/me sin token responde 401 (Caso 8 de la guía)', async () => {
  const { status } = await request(ctx.baseUrl, '/api/auth/me');
  assert.equal(status, 401);
});

test('GET /api/auth/me con token basura responde 401', async () => {
  const { status } = await request(ctx.baseUrl, '/api/auth/me', { token: 'token-invalido' });
  assert.equal(status, 401);
});

test('GET /api/auth/me con token válido responde 200 con el usuario', async () => {
  const { json: loginJson } = await request(ctx.baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email: process.env.TEST_USER_EMAIL, password: process.env.TEST_USER_PASSWORD },
  });
  const token = loginJson.data.session.access_token;

  const { status, json } = await request(ctx.baseUrl, '/api/auth/me', { token });
  assert.equal(status, 200);
  assert.equal(json.data.user.email, process.env.TEST_USER_EMAIL);
});

test('POST /api/auth/logout revoca la sesión: el mismo token deja de servir', async () => {
  // Usuario desechable propio: logout usa scope 'global' (revoca TODAS las
  // sesiones del usuario), así que no puede compartirse con TEST_USER_EMAIL
  // sin afectar a los demás archivos de prueba que corren en paralelo.
  const ephemeralUser = await createEphemeralAuthUser();
  try {
    const { json: loginJson } = await request(ctx.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: ephemeralUser.email, password: ephemeralUser.password },
    });
    const token = loginJson.data.session.access_token;

    const logoutRes = await request(ctx.baseUrl, '/api/auth/logout', { method: 'POST', token });
    assert.equal(logoutRes.status, 200);

    const meRes = await request(ctx.baseUrl, '/api/auth/me', { token });
    assert.equal(meRes.status, 401);
  } finally {
    await deleteEphemeralAuthUser(ephemeralUser.id);
  }
});
