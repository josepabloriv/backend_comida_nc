import { Router } from 'express';
import * as activitiesController from '../controllers/activities.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/active', authenticate, activitiesController.getActive);

export default router;
