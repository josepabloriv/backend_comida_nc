import QRCode from 'qrcode';

/**
 * Convierte el qr_payload proveniente de PostgreSQL (v_qr_actual /
 * resultado de registrar_pago / regenerar_qr) en una imagen QR (data URL
 * PNG en base64), lista para que el frontend la muestre con <img src=...>.
 *
 * IMPORTANTE: nunca genera un nuevo token aquí. El token oficial siempre
 * proviene de PostgreSQL; esta función solo dibuja lo que recibe.
 * Ver GUIA-BACKEND-ACTIVIDAD-CULTURAL.md, sección 33.
 *
 * @param {object} qrPayload objeto JSON con al menos token/version/estudiante/platos
 */
export async function generateQrImageDataUrl(qrPayload) {
  const content = JSON.stringify(qrPayload);
  return QRCode.toDataURL(content, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
  });
}
