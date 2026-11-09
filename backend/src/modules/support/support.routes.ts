import { Router, type Router as ExpressRouter } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  closeSupportRequestHandler,
  createSupportRequestHandler,
  listCompanySupportRequestsHandler,
  listPlatformSupportRequestsHandler,
  respondSupportRequestHandler,
} from './support.controller.js';
import {
  createSupportRequestSchema,
  listSupportRequestsSchema,
  respondSupportRequestSchema,
  supportRequestSchema,
} from './support.validation.js';

const router: ExpressRouter = Router();

router.use(authenticate);

router.get(
  '/company/support',
  authorize('company_admin'),
  validate(listSupportRequestsSchema),
  listCompanySupportRequestsHandler
);
router.post(
  '/company/support',
  authorize('company_admin'),
  validate(createSupportRequestSchema),
  createSupportRequestHandler
);

router.get(
  '/platform/support',
  authorize('platform_admin'),
  validate(listSupportRequestsSchema),
  listPlatformSupportRequestsHandler
);
router.post(
  '/platform/support/:id/respond',
  authorize('platform_admin'),
  validate(respondSupportRequestSchema),
  respondSupportRequestHandler
);
router.post(
  '/platform/support/:id/close',
  authorize('platform_admin'),
  validate(supportRequestSchema),
  closeSupportRequestHandler
);

export default router;
