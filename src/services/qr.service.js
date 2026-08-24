import { generateQrImageDataUrl } from '../utils/qrGenerator.js';

/**
 * Traduce un error de regenerar_qr() (PostgreSQL) a un error HTTP entendible.
 * Ver GUIA-BACKEND-ACTIVIDAD-CULTURAL.md, sección 32.
 */
function mapRpcError(error) {
  const message = error.message || 'No se pudo procesar la operación de QR.';
  let status = 422;

  if (/no existe|no encontr|sin pagos registrados/i.test(message)) {
    status = 404;
  }

  const err = new Error(message);
  err.status = status;
  err.publicMessage = message;
  return err;
}

/**
 * QR vigente de una cuenta (v_qr_actual), con su representación visual.
 */
export async function getCurrentQr(supabase, accountId) {
  const { data, error } = await supabase.from('v_qr_actual').select('*').eq('account_id', accountId).maybeSingle();

  if (error) throw error;

  if (!data) {
    const err = new Error('No se encontró un QR activo para esta cuenta.');
    err.status = 404;
    err.publicMessage = err.message;
    throw err;
  }

  const qrImage = await generateQrImageDataUrl(data.qr_payload);

  return { ...data, qrImage };
}

/**
 * Historial completo de versiones de QR de una cuenta (v_historial_qr),
 * más reciente primero.
 */
export async function getQrHistory(supabase, accountId) {
  const { data, error } = await supabase
    .from('v_historial_qr')
    .select('*')
    .eq('account_id', accountId)
    .order('version', { ascending: false });

  if (error) throw error;

  return data;
}

/**
 * Regenera manualmente el QR de una cuenta vía regenerar_qr(). Invalida la
 * versión anterior y crea una nueva. Devuelve el QR resultante ya con su
 * representación visual (re-consultando v_qr_actual, que trae el
 * qr_payload completo necesario para dibujar la imagen).
 */
export async function regenerateQr(supabase, accountId) {
  const { error } = await supabase.rpc('regenerar_qr', { p_account_id: accountId });

  if (error) throw mapRpcError(error);

  return getCurrentQr(supabase, accountId);
}

/**
 * Valida un token de QR escaneado contra PostgreSQL (validar_qr). Esta RPC
 * no lanza error de negocio: siempre responde con es_valido true/false y un
 * mensaje. El contenido del QR (nombre/platos) nunca es la fuente de
 * verdad; el token siempre se valida aquí.
 */
export async function validateQr(supabase, tokenValue) {
  const { data, error } = await supabase.rpc('validar_qr', { p_token: tokenValue });

  if (error) throw error;

  return data;
}
