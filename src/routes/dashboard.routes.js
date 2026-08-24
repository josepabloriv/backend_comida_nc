import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/', authenticate, dashboardController.getTotals);
router.get('/daily', authenticate, dashboardController.getDaily);
router.get('/by-grade', authenticate, dashboardController.getByGrade);

export default router;
