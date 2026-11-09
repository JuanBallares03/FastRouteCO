import { Router, type Router as ExpressRouter } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  getDashboardHandler,
  getReportsHandler,
  getRouteReportsHandler,
} from './reports.controller.js';
import { reportSummarySchema } from './reports.validation.js';

const router: ExpressRouter = Router();

router.use(authenticate);

router.get(
  '/dashboard',
  authorize('company_admin', 'supervisor'),
  getDashboardHandler
);
router.get(
  '/summary',
  authorize('company_admin'),
  validate(reportSummarySchema),
  getReportsHandler
);
router.get(
  '/routes',
  authorize('company_admin', 'supervisor'),
  validate(reportSummarySchema),
  getRouteReportsHandler
);

export default router;
