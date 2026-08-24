import * as paymentsService from '../services/payments.service.js';
import { success } from '../utils/apiResponse.js';

export async function create(req, res, next) {
  try {
    const { studentId, montoCuota, cantidadPlatosExtra, metodoPago, observaciones } = req.body;

    const result = await paymentsService.registrarPago(req.supabase, {
      studentId,
      montoCuota,
      cantidadPlatosExtra,
      metodoPago,
      observaciones,
    });

    return success(res, {
      message: 'Pago registrado correctamente.',
      data: result,
      status: 201,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const payment = await paymentsService.getPaymentById(req.supabase, req.params.id);
    return success(res, { message: 'Pago obtenido.', data: { payment } });
  } catch (err) {
    return next(err);
  }
}

export async function listByStudent(req, res, next) {
  try {
    const payments = await paymentsService.listPaymentsByStudent(req.supabase, req.params.studentId);
    return success(res, { message: 'Historial de pagos obtenido.', data: { payments } });
  } catch (err) {
    return next(err);
  }
}
