const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valida el payload de POST /api/payments.
 *
 * Estas son validaciones de forma (tipo, presencia, rango básico). La regla
 * financiera autoritativa (que el acumulado nunca supere Q150) la aplica
 * PostgreSQL dentro de registrar_pago(); aquí solo se filtra basura antes
 * de llegar al RPC. Ver GUIA-BACKEND-ACTIVIDAD-CULTURAL.md, secciones 8 y 27.
 *
 * @param {object} body
 * @returns {string[]} errores encontrados (vacío si es válido)
 */
export function validateCreatePayment(body) {
  const errors = [];

  if (!body.studentId || typeof body.studentId !== 'string' || !UUID_REGEX.test(body.studentId)) {
    errors.push('El campo "studentId" es obligatorio y debe ser un UUID válido.');
  }

  if (typeof body.montoCuota !== 'number' || !Number.isFinite(body.montoCuota) || body.montoCuota <= 0) {
    errors.push('El campo "montoCuota" es obligatorio y debe ser un número mayor a 0.');
  } else if (body.montoCuota > 150) {
    // La cuota cultural es Q150 (sección 8 de la guía): ningún pago individual
    // puede superar ese monto. El límite acumulado real lo valida PostgreSQL.
    errors.push('El campo "montoCuota" no puede superar Q150.00.');
  }

  if (body.cantidadPlatosExtra !== undefined && body.cantidadPlatosExtra !== null) {
    if (!Number.isInteger(body.cantidadPlatosExtra) || body.cantidadPlatosExtra < 0) {
      errors.push('El campo "cantidadPlatosExtra" debe ser un número entero mayor o igual a 0.');
    }
  }

  if (!body.metodoPago || typeof body.metodoPago !== 'string' || body.metodoPago.trim().length === 0) {
    errors.push('El campo "metodoPago" es obligatorio.');
  }

  if (body.observaciones !== undefined && body.observaciones !== null && typeof body.observaciones !== 'string') {
    errors.push('El campo "observaciones" debe ser texto o null.');
  }

  return errors;
}
