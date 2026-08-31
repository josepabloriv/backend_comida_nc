/**
 * Da forma al comprobante a partir de los datos ya obtenidos de PostgreSQL
 * (v_comprobantes + activity + qr_tickets + email del usuario).
 *
 * Esta función es pura (sin acceso a datos): separa "preparar el
 * comprobante" (aquí) de "consultar los datos" (receipts.service.js), tal
 * como exige GUIA-BACKEND-ACTIVIDAD-CULTURAL.md, sección 34.
 *
 * Un mismo comprobante se imprime en dos copias visuales idénticas
 * (CONTRIBUYENTE / REGISTRO) a partir de este único objeto — nunca se
 * generan ni almacenan dos registros.
 *
 * @param {object} params
 * @param {object} params.receipt fila de v_comprobantes
 * @param {{cuota_base:number, platos_incluidos:number}} params.activity
 * @param {{qr_token:string, version:number, activo:boolean}|null} params.qrRow
 * @param {string|null} params.qrImage data URL de la imagen QR (solo si el QR sigue activo)
 * @param {string|null} params.registradoPorEmail
 * @param {string} params.studentId id interno del estudiante (activity_accounts.student_id),
 *   para que el frontend pueda enlazar "Agregar más platos" de vuelta al mismo estudiante
 *   sin tener que volver a buscarlo.
 */
export function buildReceipt({ receipt, activity, qrRow, qrImage, registradoPorEmail, studentId }) {
  // Cada pago es una compra completa de los platos que alcanzó a cubrir:
  // ya no existe un estado "PENDIENTE" que implique deuda. Mismo criterio
  // que v_estado_cuentas y registrar_pago() (PostgreSQL).
  const cuotaPagada = Number(receipt.cuota_acumulada) > 0;
  // Platos base ya ganados, proporcional al pago acumulado: cada
  // (cuota_base / platos_incluidos) pagado habilita 1 plato, hasta el
  // máximo de platos_incluidos. Misma regla aplicada en v_estado_cuentas
  // y registrar_pago() (PostgreSQL) para que comprobante, cuenta y QR
  // siempre coincidan.
  const platosBase =
    activity.platos_incluidos > 0
      ? Math.min(
          Math.floor(Number(receipt.cuota_acumulada) / (Number(activity.cuota_base) / activity.platos_incluidos)),
          activity.platos_incluidos
        )
      : 0;
  const totalPlatos = platosBase + receipt.platos_extra_acumulados;

  let qr = null;
  if (qrRow) {
    qr = qrRow.activo
      ? {
          token: qrRow.qr_token,
          version: qrRow.version,
          activo: true,
          image: qrImage,
        }
      : {
          token: qrRow.qr_token,
          version: qrRow.version,
          activo: false,
          image: null,
          nota: 'Este QR fue reemplazado por una versión más reciente; ya no es válido para el acceso.',
        };
  }

  // Nombres en snake_case para mantener la misma convención que el resto de
  // la API (v_comprobantes, v_estado_cuentas, payments) y que consume el
  // frontend (ReceiptPage.jsx).
  return {
    numero_comprobante: receipt.numero_comprobante,
    payment_id: receipt.payment_id,
    payment_number: receipt.payment_number,
    student_id: studentId,
    actividad: receipt.actividad,
    fecha: receipt.fecha_guatemala,
    estudiante: receipt.estudiante,
    grado: receipt.grado,
    monto_cuota: receipt.monto_cuota,
    cantidad_platos_extra: receipt.cantidad_platos_extra,
    precio_plato_extra: receipt.precio_plato_extra,
    total_extras: receipt.total_extras,
    total_recibido: receipt.total_pago,
    metodo_pago: receipt.metodo_pago,
    observaciones: receipt.observaciones,
    cuota_acumulada: receipt.cuota_acumulada,
    // Ya no es una deuda: es el monto que, si el estudiante quisiera,
    // podría pagar de más para sumar más platos hasta completar la
    // cuota (informativo, nunca un saldo que se "deba").
    disponible_adicional: receipt.saldo_despues_pago,
    estado_cuota: cuotaPagada ? 'PAGADO' : 'SIN PAGO',
    total_platos: totalPlatos,
    qr,
    qr_image: qr?.image ?? null,
    registrado_por: receipt.registrado_por,
    usuario: registradoPorEmail,
    copias: ['COPIA CONTRIBUYENTE', 'COPIA REGISTRO'],
  };
}
