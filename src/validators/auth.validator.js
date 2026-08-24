const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida el payload de POST /api/auth/login.
 * @param {object} body
 * @returns {string[]} errores encontrados (vacío si es válido)
 */
export function validateLogin(body) {
  const errors = [];

  if (!body.email || typeof body.email !== 'string' || !EMAIL_REGEX.test(body.email)) {
    errors.push('El campo "email" es obligatorio y debe tener un formato válido.');
  }

  if (!body.password || typeof body.password !== 'string' || body.password.length < 1) {
    errors.push('El campo "password" es obligatorio.');
  }

  return errors;
}
