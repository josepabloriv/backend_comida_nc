import { Router } from 'express';
import * as paymentsController from '../controllers/payments.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { validateCreatePayment } from '../validators/payment.validator.js';

const router = Router();

router.post('/', authenticate, validateRequest(validateCreatePayment), paymentsController.create);
router.get('/:id', authenticate, paymentsController.getById);

export default router;
