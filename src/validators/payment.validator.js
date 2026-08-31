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

  // montoCuota puede ser 0 (ej. cuando ya se completó la cuota y solo se
  // están agregando platos extra); la única combinación inválida es
  // montoCuota = 0 Y cantidadPlatosExtra = 0 a la vez (validado más abajo),
  // igual que exige registrar_pago() en PostgreSQL.
  const montoCuotaValido =
    typeof body.montoCuota === 'number' && Number.isFinite(body.montoCuota) && body.montoCuota >= 0;

  if (!montoCuotaValido) {
    errors.push('El campo "montoCuota" es obligatorio y debe ser un número mayor o igual a 0.');
  } else if (body.montoCuota > 150) {
    // La cuota cultural es Q150 (sección 8 de la guía): ningún pago individual
    // puede superar ese monto. El límite acumulado real lo valida PostgreSQL.
    errors.push('El campo "montoCuota" no puede superar Q150.00.');
  }

  const cantidadPlatosExtraValida =
    body.cantidadPlatosExtra === undefined ||
    body.cantidadPlatosExtra === null ||
    (Number.isInteger(body.cantidadPlatosExtra) && body.cantidadPlatosExtra >= 0);

  if (!cantidadPlatosExtraValida) {
    errors.push('El campo "cantidadPlatosExtra" debe ser un número entero mayor o igual a 0.');
  }

  const cantidadPlatosExtra = body.cantidadPlatosExtra ?? 0;
  if (montoCuotaValido && cantidadPlatosExtraValida && body.montoCuota === 0 && cantidadPlatosExtra === 0) {
    errors.push('Debe registrar un monto de cuota mayor a 0 o al menos un plato extra.');
  }

  if (!body.metodoPago || typeof body.metodoPago !== 'string' || body.metodoPago.trim().length === 0) {
    errors.push('El campo "metodoPago" es obligatorio.');
  }

  if (body.observaciones !== undefined && body.observaciones !== null && typeof body.observaciones !== 'string') {
    errors.push('El campo "observaciones" debe ser texto o null.');
  }

  return errors;
}
