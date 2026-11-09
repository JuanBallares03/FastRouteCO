import { Router, type Router as ExpressRouter } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { listSettingsHandler, updateSettingsHandler } from './settings.controller.js';
import { updateSystemSettingsSchema } from './settings.validation.js';

const router: ExpressRouter = Router();

router.use(authenticate);
router.use(authorize('platform_admin'));

router.get('/settings', listSettingsHandler);
router.patch('/settings', validate(updateSystemSettingsSchema), updateSettingsHandler);

export default router;
