import { error } from '../utils/apiResponse.js';

/**
 * Captura cualquier ruta no definida. Debe montarse después de todas las
 * rutas y antes del errorHandler.
 */
export function notFound(req, res) {
  return error(res, {
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    status: 404,
  });
}
