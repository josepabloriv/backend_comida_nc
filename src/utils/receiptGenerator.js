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
 */
export function buildReceipt({ receipt, activity, qrRow, qrImage, registradoPorEmail }) {
  const cuotaCompleta = Number(receipt.saldo_despues_pago) <= 0;
  const totalPlatos = (cuotaCompleta ? activity.platos_incluidos : 0) + receipt.platos_extra_acumulados;

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

  return {
    numeroComprobante: receipt.numero_comprobante,
    paymentId: receipt.payment_id,
    paymentNumber: receipt.payment_number,
    actividad: receipt.actividad,
    fecha: receipt.fecha_guatemala,
    estudiante: receipt.estudiante,
    grado: receipt.grado,
    montoCuota: receipt.monto_cuota,
    cantidadPlatosExtra: receipt.cantidad_platos_extra,
    precioPlatoExtra: receipt.precio_plato_extra,
    totalExtras: receipt.total_extras,
    totalRecibido: receipt.total_pago,
    metodoPago: receipt.metodo_pago,
    observaciones: receipt.observaciones,
    cuotaAcumulada: receipt.cuota_acumulada,
    saldoPendiente: receipt.saldo_despues_pago,
    estadoCuota: cuotaCompleta ? 'PAGADA' : 'PENDIENTE',
    cantidadTotalPlatos: totalPlatos,
    qr,
    registradoPor: {
      id: receipt.registrado_por,
      email: registradoPorEmail,
    },
    copias: ['COPIA CONTRIBUYENTE', 'COPIA REGISTRO'],
  };
}
