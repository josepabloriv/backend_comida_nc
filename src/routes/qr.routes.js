import { Router } from 'express';
import * as qrController from '../controllers/qr.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { validateAccountIdParam, validateValidateQrBody } from '../validators/qr.validator.js';

const router = Router();

router.get('/:accountId/current', authenticate, validateAccountIdParam, qrController.getCurrent);
router.get('/:accountId/history', authenticate, validateAccountIdParam, qrController.getHistory);
router.post('/:accountId/regenerate', authenticate, validateAccountIdParam, qrController.regenerate);
router.post('/validate', authenticate, validateRequest(validateValidateQrBody), qrController.validate);

export default router;
