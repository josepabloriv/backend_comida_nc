import * as receiptsService from '../services/receipts.service.js';
import { success } from '../utils/apiResponse.js';

export async function getReceipt(req, res, next) {
  try {
    const receipt = await receiptsService.getReceiptData(req.supabase, req.params.id);
    return success(res, { message: 'Comprobante obtenido.', data: { receipt } });
  } catch (err) {
    return next(err);
  }
}
