import * as qrService from '../services/qr.service.js';
import { success } from '../utils/apiResponse.js';

export async function getCurrent(req, res, next) {
  try {
    const qr = await qrService.getCurrentQr(req.supabase, req.params.accountId);
    return success(res, { message: 'QR actual obtenido.', data: { qr } });
  } catch (err) {
    return next(err);
  }
}

export async function getHistory(req, res, next) {
  try {
    const history = await qrService.getQrHistory(req.supabase, req.params.accountId);
    return success(res, { message: 'Historial de QR obtenido.', data: { history } });
  } catch (err) {
    return next(err);
  }
}

export async function regenerate(req, res, next) {
  try {
    const qr = await qrService.regenerateQr(req.supabase, req.params.accountId);
    return success(res, { message: 'QR regenerado correctamente.', data: { qr } });
  } catch (err) {
    return next(err);
  }
}

export async function validate(req, res, next) {
  try {
    const result = await qrService.validateQr(req.supabase, req.body.token);
    return success(res, {
      message: result.es_valido ? 'QR válido.' : 'QR inválido.',
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}
