import { Router } from 'express';
import * as receiptsController from '../controllers/receipts.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// Montado bajo /api/payments (ver app.js) para producir GET /api/payments/:id/receipt.
router.get('/:id/receipt', authenticate, receiptsController.getReceipt);

export default router;
