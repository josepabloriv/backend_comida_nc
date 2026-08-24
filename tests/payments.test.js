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

function pay(body, extraToken) {
  return request(ctx.baseUrl, '/api/payments', { method: 'POST', token: extraToken ?? token, body });
}

test('Caso 1 y 2: anticipos hasta completar la cuota (Q50 luego Q100 → Q150, 3 platos)', async () => {
  const student = await createTestStudent('caso1y2');
  try {
    const r1 = await pay({ studentId: student.id, montoCuota: 50, cantidadPlatosExtra: 0, metodoPago: 'EFECTIVO' });
    assert.equal(r1.status, 201);
    assert.equal(r1.json.data.estado_cuenta.saldo, 100);
    assert.equal(r1.json.data.estado_cuenta.cuota_completa, false);

    const r2 = await pay({ studentId: student.id, montoCuota: 100, cantidadPlatosExtra: 0, metodoPago: 'EFECTIVO' });
    assert.equal(r2.status, 201);
    assert.equal(r2.json.data.estado_cuenta.saldo, 0);
    assert.equal(r2.json.data.estado_cuenta.cuota_completa, true);
    assert.equal(r2.json.data.estado_cuenta.total_platos, 3);
  } finally {
    await deleteTestStudent(student.id);
  }
});

test('Caso 3: pagado Q140, intentar pagar Q20 más → RECHAZADO (409)', async () => {
  const student = await createTestStudent('caso3');
  try {
    const r1 = await pay({ studentId: student.id, montoCuota: 140, cantidadPlatosExtra: 0, metodoPago: 'EFECTIVO' });
    assert.equal(r1.status, 201);

    const r2 = await pay({ studentId: student.id, montoCuota: 20, cantidadPlatosExtra: 0, metodoPago: 'EFECTIVO' });
    assert.equal(r2.status, 409);
    assert.match(r2.json.message, /excede el saldo pendiente/i);
  } finally {
    await deleteTestStudent(student.id);
  }
});

test('Caso 4: Q150 de cuota + 2 platos extra en un solo pago → total Q230, 5 platos', async () => {
  const student = await createTestStudent('caso4');
  try {
    const r = await pay({ studentId: student.id, montoCuota: 150, cantidadPlatosExtra: 2, metodoPago: 'EFECTIVO' });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.pago_actual.total_pago, 230);
    assert.equal(r.json.data.estado_cuenta.total_platos, 5);
  } finally {
    await deleteTestStudent(student.id);
  }
});

test('Caso 8: registrar pago sin JWT responde 401', async () => {
  const student = await createTestStudent('caso8');
  try {
    const r = await pay({ studentId: student.id, montoCuota: 50, metodoPago: 'EFECTIVO' }, '');
    assert.equal(r.status, 401);
  } finally {
    await deleteTestStudent(student.id);
  }
});

test('POST /api/payments con payload inválido responde 422', async () => {
  const r = await pay({ studentId: 'no-es-uuid', montoCuota: -10, metodoPago: '' });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.length >= 3);
});

test('GET /api/payments/:id y GET /api/students/:id/payments reflejan el pago registrado', async () => {
  const student = await createTestStudent('detalle-historial');
  try {
    const created = await pay({ studentId: student.id, montoCuota: 75, cantidadPlatosExtra: 1, metodoPago: 'TARJETA' });
    const paymentId = created.json.data.payment_id;

    const detail = await request(ctx.baseUrl, `/api/payments/${paymentId}`, { token });
    assert.equal(detail.status, 200);
    assert.equal(detail.json.data.payment.id, paymentId);
    assert.equal(detail.json.data.payment.monto_cuota, 75);

    const history = await request(ctx.baseUrl, `/api/students/${student.id}/payments`, { token });
    assert.equal(history.status, 200);
    assert.equal(history.json.data.payments.length, 1);
    assert.equal(history.json.data.payments[0].id, paymentId);
  } finally {
    await deleteTestStudent(student.id);
  }
});

test('GET /api/payments/:id inexistente responde 404', async () => {
  const { status } = await request(ctx.baseUrl, '/api/payments/00000000-0000-0000-0000-000000000000', { token });
  assert.equal(status, 404);
});
