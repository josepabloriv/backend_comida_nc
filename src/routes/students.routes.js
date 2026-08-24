import { Router } from 'express';
import * as studentsController from '../controllers/students.controller.js';
import * as paymentsController from '../controllers/payments.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/', authenticate, studentsController.list);
router.get('/:id', authenticate, studentsController.getById);
router.get('/:id/account', authenticate, studentsController.getAccount);
router.get('/:studentId/payments', authenticate, paymentsController.listByStudent);

export default router;
