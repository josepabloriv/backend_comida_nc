import { env } from '../config/env.js';
import { error } from '../utils/apiResponse.js';

/**
 * Middleware centralizado de errores. Debe montarse al final de la cadena,
 * después de notFound.
 *
 * Convención: los services/controllers pueden lanzar errores con
 * `err.status` y `err.publicMessage` para controlar la respuesta HTTP.
 * Si no se especifican, se responde 500 sin exponer detalles internos.
 *
 * Ver GUIA-BACKEND-ACTIVIDAD-CULTURAL.md, sección 26.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.publicMessage || err.message || 'Error interno del servidor';

  if (!env.isProduction) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  return error(res, {
    message: status >= 500 ? 'Error interno del servidor' : message,
    err: env.isProduction ? undefined : (err.stack || String(err)),
    status,
  });
}
