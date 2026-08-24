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

test('GET /api/payments/:id/receipt de un pago con QR vigente incluye la imagen', async () => {
  const student = await createTestStudent('receipt-vigente');
  try {
    const payRes = await request(ctx.baseUrl, '/api/payments', {
      method: 'POST',
      token,
      body: { studentId: student.id, montoCuota: 150, cantidadPlatosExtra: 1, metodoPago: 'EFECTIVO' },
    });
    const paymentId = payRes.json.data.payment_id;

    const { status, json } = await request(ctx.baseUrl, `/api/payments/${paymentId}/receipt`, { token });
    assert.equal(status, 200);
    const { receipt } = json.data;

    assert.match(receipt.numeroComprobante, /^AC-\d{6}$/);
    assert.equal(receipt.estadoCuota, 'PAGADA');
    assert.equal(receipt.cantidadTotalPlatos, 4); // 3 base + 1 extra
    assert.equal(receipt.totalRecibido, 190);
    assert.deepEqual(receipt.copias, ['COPIA CONTRIBUYENTE', 'COPIA REGISTRO']);
    assert.equal(receipt.qr.activo, true);
    assert.ok(receipt.qr.image.startsWith('data:image/png;base64,'));
  } finally {
    await deleteTestStudent(student.id);
  }
});

test('el comprobante de un pago cuyo QR ya fue reemplazado no ofrece imagen', async () => {
  const student = await createTestStudent('receipt-reemplazado');
  try {
    const payRes = await request(ctx.baseUrl, '/api/payments', {
      method: 'POST',
      token,
      body: { studentId: student.id, montoCuota: 50, cantidadPlatosExtra: 0, metodoPago: 'EFECTIVO' },
    });
    const paymentId = payRes.json.data.payment_id;
    const accountId = payRes.json.data.account_id;

    await request(ctx.baseUrl, `/api/qr/${accountId}/regenerate`, { method: 'POST', token });

    const { json } = await request(ctx.baseUrl, `/api/payments/${paymentId}/receipt`, { token });
    assert.equal(json.data.receipt.qr.activo, false);
    assert.equal(json.data.receipt.qr.image, null);
  } finally {
    await deleteTestStudent(student.id);
  }
});

test('GET /api/payments/:id/receipt de un pago inexistente responde 404', async () => {
  const { status } = await request(ctx.baseUrl, '/api/payments/00000000-0000-0000-0000-000000000000/receipt', { token });
  assert.equal(status, 404);
});
