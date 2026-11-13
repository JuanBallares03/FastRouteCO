import { Router, type Router as ExpressRouter } from 'express';
import {
  cancelOrderHandler,
  createOrderHandler,
  getOrderHandler,
  listOrdersHandler,
  updateOrderHandler,
} from './orders.controller.js';
import {
  cancelOrderSchema,
  createOrderSchema,
  getOrderSchema,
  listOrdersSchema,
  updateOrderSchema,
} from './orders.validation.js';
import {
  assignOrderHandler,
  suggestDriversHandler,
} from '../routes/routes.controller.js';
import { assignOrderSchema, suggestDriversSchema } from '../routes/routes.validation.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

const router: ExpressRouter = Router();

router.use(authenticate);

router.post(
  '/',
  authorize('company_admin', 'supervisor'),
  validate(createOrderSchema),
  createOrderHandler
);
router.get(
  '/',
  authorize('company_admin', 'supervisor'),
  validate(listOrdersSchema),
  listOrdersHandler
);
router.get(
  '/:id',
  authorize('company_admin', 'supervisor'),
  validate(getOrderSchema),
  getOrderHandler
);
router.patch(
  '/:id',
  authorize('company_admin', 'supervisor'),
  validate(updateOrderSchema),
  updateOrderHandler
);
router.post(
  '/:id/cancel',
  authorize('company_admin', 'supervisor'),
  validate(cancelOrderSchema),
  cancelOrderHandler
);
router.get(
  '/:id/driver-suggestions',
  authorize('company_admin', 'supervisor'),
  validate(suggestDriversSchema),
  suggestDriversHandler
);
router.post(
  '/:id/assign',
  authorize('company_admin', 'supervisor'),
  validate(assignOrderSchema),
  assignOrderHandler
);

export default router;
