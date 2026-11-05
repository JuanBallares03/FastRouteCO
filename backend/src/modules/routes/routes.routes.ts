import { Router, type Router as ExpressRouter } from 'express';
import { createRouteHandler, getRouteHandler, listRoutesHandler } from './routes.controller.js';
import { createRouteSchema, getRouteSchema, listRoutesSchema } from './validation.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

const router: ExpressRouter = Router();

router.use(authenticate);

router.post(
  '/',
  authorize('company_admin', 'supervisor'),
  validate(createRouteSchema),
  createRouteHandler
);
router.get(
  '/',
  authorize('company_admin', 'supervisor'),
  validate(listRoutesSchema),
  listRoutesHandler
);
router.get(
  '/:id',
  authorize('company_admin', 'supervisor'),
  validate(getRouteSchema),
  getRouteHandler
);

export default router;
