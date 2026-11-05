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
} from './validation.js';
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

export default router;
