import { error } from '../utils/apiResponse.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware: valida que req.params.accountId sea un UUID.
 * Evita que un valor inválido llegue crudo a Postgres y provoque un 500
 * genérico en vez de un 400 entendible.
 */
export function validateAccountIdParam(req, res, next) {
  if (!UUID_REGEX.test(req.params.accountId || '')) {
    return error(res, {
      message: 'El parámetro "accountId" debe ser un UUID válido.',
      status: 400,
    });
  }
  next();
}

/**
 * Valida el payload de POST /api/qr/validate.
 * El token siempre debe verificarse contra PostgreSQL (validar_qr); aquí
 * solo se valida la forma antes de invocar el RPC.
 */
export function validateValidateQrBody(body) {
  const errors = [];

  if (!body.token || typeof body.token !== 'string' || !UUID_REGEX.test(body.token)) {
    errors.push('El campo "token" es obligatorio y debe ser un UUID válido.');
  }

  return errors;
}
