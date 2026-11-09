import { Router, type Router as ExpressRouter } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  getPlatformOverviewHandler,
  listAlertsHandler,
  resolveAlertHandler,
} from './monitoring.controller.js';
import { alertParamsSchema, listAlertsSchema } from './monitoring.validation.js';

const router: ExpressRouter = Router();

router.use(authenticate);
router.use(authorize('platform_admin'));

router.get('/monitoring', getPlatformOverviewHandler);
router.get('/alerts', validate(listAlertsSchema), listAlertsHandler);
router.post('/alerts/:id/resolve', validate(alertParamsSchema), resolveAlertHandler);

export default router;
