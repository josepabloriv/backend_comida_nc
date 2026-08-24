import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers/testServer.js';
import { request, loginTestUser } from './helpers/api.js';

let ctx;
let token;

before(async () => {
  ctx = await startTestServer();
  token = await loginTestUser(ctx.baseUrl);
});

after(async () => {
  await ctx.close();
});

// No se afirman valores exactos: otras suites corren en paralelo y afectan
// los mismos agregados de la actividad activa. Solo se valida la forma.

test('GET /api/dashboard responde con los totales de la actividad activa', async () => {
  const { status, json } = await request(ctx.baseUrl, '/api/dashboard', { token });
  assert.equal(status, 200);
  const { totals } = json.data;
  assert.ok(typeof totals.ingresos_totales === 'number');
  assert.ok(typeof totals.cantidad_transacciones === 'number');
  assert.ok(totals.ingresos_totales >= 0);
});

test('GET /api/dashboard/daily responde con un arreglo', async () => {
  const { status, json } = await request(ctx.baseUrl, '/api/dashboard/daily', { token });
  assert.equal(status, 200);
  assert.ok(Array.isArray(json.data.daily));
});

test('GET /api/dashboard/daily con rango de fechas fuera de rango responde vacío', async () => {
  const { status, json } = await request(ctx.baseUrl, '/api/dashboard/daily?fecha_inicio=2000-01-01&fecha_fin=2000-01-31', {
    token,
  });
  assert.equal(status, 200);
  assert.deepEqual(json.data.daily, []);
});

test('GET /api/dashboard/by-grade responde con un arreglo', async () => {
  const { status, json } = await request(ctx.baseUrl, '/api/dashboard/by-grade', { token });
  assert.equal(status, 200);
  assert.ok(Array.isArray(json.data.byGrade));
});

test('GET /api/dashboard sin JWT responde 401', async () => {
  const { status } = await request(ctx.baseUrl, '/api/dashboard');
  assert.equal(status, 401);
});
