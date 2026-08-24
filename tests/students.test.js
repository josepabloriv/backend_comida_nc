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

test('GET /api/students sin token responde 401', async () => {
  const { status } = await request(ctx.baseUrl, '/api/students');
  assert.equal(status, 401);
});

test('GET /api/students devuelve un listado (array)', async () => {
  const { status, json } = await request(ctx.baseUrl, '/api/students', { token });
  assert.equal(status, 200);
  assert.ok(Array.isArray(json.data.students));
});

test('GET /api/students?grado= filtra por grado exacto y GET /api/students/:id obtiene el detalle', async () => {
  const student = await createTestStudent('filtro-grado');
  try {
    const { status, json } = await request(ctx.baseUrl, `/api/students?grado=${encodeURIComponent(student.grado)}`, {
      token,
    });
    assert.equal(status, 200);
    assert.ok(json.data.students.some((s) => s.id === student.id));
    assert.ok(json.data.students.every((s) => s.grado === student.grado));

    const detail = await request(ctx.baseUrl, `/api/students/${student.id}`, { token });
    assert.equal(detail.status, 200);
    assert.equal(detail.json.data.student.id, student.id);
  } finally {
    await deleteTestStudent(student.id);
  }
});

test('GET /api/students/:id con UUID inexistente responde 404', async () => {
  const { status } = await request(ctx.baseUrl, '/api/students/00000000-0000-0000-0000-000000000000', { token });
  assert.equal(status, 404);
});

test('GET /api/students/:id/account de un estudiante sin pagos: cuota PENDIENTE, 0 platos', async () => {
  const student = await createTestStudent('sin-pagos');
  try {
    const { status, json } = await request(ctx.baseUrl, `/api/students/${student.id}/account`, { token });
    assert.equal(status, 200);
    const { account } = json.data;
    assert.equal(account.account_id, null);
    assert.equal(account.estado_cuota, 'PENDIENTE');
    assert.equal(account.cuota_pagada, 0);
    assert.equal(account.total_platos, 0);
  } finally {
    await deleteTestStudent(student.id);
  }
});
