import { getStudentById } from './students.service.js';

/**
 * Traduce un error lanzado por registrar_pago() (PostgreSQL) a un error HTTP
 * entendible, sin ocultarlo bajo un genérico "Error interno del servidor".
 * Ver GUIA-BACKEND-ACTIVIDAD-CULTURAL.md, sección 32.
 */
function mapRpcError(error) {
  const message = error.message || 'No se pudo registrar el pago.';
  let status = 422; // error de validación de negocio por defecto

  if (/no existe|no encontr/i.test(message)) {
    status = 404;
  } else if (/excede|límite|limite|saldo/i.test(message)) {
    status = 409; // conflicto con el estado actual de la cuenta
  }

  const err = new Error(message);
  err.status = status;
  err.publicMessage = message;
  return err;
}

/**
 * Registra un pago llamando exclusivamente a la RPC registrar_pago().
 * Nunca se inserta directamente en la tabla payments.
 *
 * El precio de plato extra y el límite de Q150 los valida y aplica
 * PostgreSQL; aquí solo se propaga el resultado o el error.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase cliente
 *   contextualizado con el JWT del usuario autenticado (req.supabase), para
 *   que auth.uid() quede registrado como responsable del pago.
 */
export async function registrarPago(
  supabase,
  { studentId, montoCuota, cantidadPlatosExtra, metodoPago, observaciones }
) {
  const { data, error } = await supabase.rpc('registrar_pago', {
    p_student_id: studentId,
    p_monto_cuota: montoCuota,
    p_cantidad_platos_extra: cantidadPlatosExtra ?? 0,
    p_metodo_pago: metodoPago,
    p_observaciones: observaciones ?? null,
  });

  if (error) throw mapRpcError(error);

  return data;
}

/**
 * Obtiene un pago por su id (registro crudo de la tabla payments).
 * Para la representación de comprobante (dos copias, datos enriquecidos)
 * ver receipts.service.js (Fase 6), que usa v_comprobantes.
 */
export async function getPaymentById(supabase, paymentId) {
  const { data, error } = await supabase.from('payments').select('*').eq('id', paymentId).maybeSingle();

  if (error) throw error;

  if (!data) {
    const err = new Error('Pago no encontrado.');
    err.status = 404;
    err.publicMessage = 'Pago no encontrado.';
    throw err;
  }

  return data;
}

/**
 * Historial de pagos de un estudiante, a través de todas sus
 * activity_accounts (no solo la actividad activa).
 */
export async function listPaymentsByStudent(supabase, studentId) {
  await getStudentById(supabase, studentId); // 404 si el estudiante no existe

  const { data: accounts, error: accountsError } = await supabase
    .from('activity_accounts')
    .select('id')
    .eq('student_id', studentId);

  if (accountsError) throw accountsError;
  if (!accounts || accounts.length === 0) return [];

  const accountIds = accounts.map((a) => a.id);

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .in('account_id', accountIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data;
}
