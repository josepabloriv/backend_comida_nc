import { supabaseAdmin } from '../config/supabase.js';
import { generateQrImageDataUrl } from '../utils/qrGenerator.js';
import { buildReceipt } from '../utils/receiptGenerator.js';

/**
 * Prepara el comprobante de un pago a partir de v_comprobantes, enriquecido
 * con el QR generado por ese pago específico y el email de quien lo
 * registró. Ver GUIA-BACKEND-ACTIVIDAD-CULTURAL.md, secciones 18 y 34.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase cliente
 *   contextualizado con el JWT del usuario autenticado (req.supabase).
 */
export async function getReceiptData(supabase, paymentId) {
  const { data: receipt, error: receiptError } = await supabase
    .from('v_comprobantes')
    .select('*')
    .eq('payment_id', paymentId)
    .maybeSingle();

  if (receiptError) throw receiptError;

  if (!receipt) {
    const err = new Error('Comprobante no encontrado.');
    err.status = 404;
    err.publicMessage = 'Comprobante no encontrado.';
    throw err;
  }

  const { data: account, error: accountError } = await supabase
    .from('activity_accounts')
    .select('activity_id')
    .eq('id', receipt.account_id)
    .maybeSingle();

  if (accountError) throw accountError;

  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .select('cuota_base, platos_incluidos')
    .eq('id', account.activity_id)
    .maybeSingle();

  if (activityError) throw activityError;

  // El QR generado por este pago específico comparte el mismo timestamp de
  // la transacción (qr_tickets.generated_at === payments.created_at).
  const { data: qrRow, error: qrError } = await supabase
    .from('qr_tickets')
    .select('qr_token, version, activo, generated_at')
    .eq('account_id', receipt.account_id)
    .eq('generated_at', receipt.created_at)
    .maybeSingle();

  if (qrError) throw qrError;

  let qrImage = null;
  if (qrRow?.activo) {
    qrImage = await generateQrImageDataUrl({
      token: qrRow.qr_token,
      version: qrRow.version,
      estudiante: receipt.estudiante,
      grado: receipt.grado,
    });
  }

  let registradoPorEmail = null;
  try {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(receipt.registrado_por);
    registradoPorEmail = userData?.user?.email ?? null;
  } catch {
    registradoPorEmail = null;
  }

  return buildReceipt({ receipt, activity, qrRow, qrImage, registradoPorEmail });
}
