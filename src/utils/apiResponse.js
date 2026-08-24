/**
 * Formato de respuesta estándar de la API.
 * Ver GUIA-BACKEND-ACTIVIDAD-CULTURAL.md, sección 26.
 */

export function success(res, { message = 'OK', data = {}, status = 200 } = {}) {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
}

export function error(res, { message = 'Error', err = null, status = 500 } = {}) {
  return res.status(status).json({
    success: false,
    message,
    error: err,
  });
}
