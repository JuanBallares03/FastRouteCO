import { Router, type Router as ExpressRouter } from 'express';
import {
  createCardSetupHandler,
  getBillingHandler,
  getOfferingsHandler,
  getUsageHandler,
  listPaymentsHandler,
  listTransactionsHandler,
  listUsageChargesHandler,
  purchaseCreditsHandler,
  purchaseModuleHandler,
  registerCardHandler,
  subscribeHandler,
  updateSpendingLimitHandler,
} from './billing.controller.js';
import {
  listBillingHistorySchema,
  purchaseCreditsSchema,
  purchaseModuleSchema,
  registerCardSchema,
  subscribeSchema,
  updateSpendingLimitSchema,
} from './billing.validation.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

const router: ExpressRouter = Router();

router.use(authenticate);
router.use(authorize('company_admin'));

router.get('/billing', getBillingHandler);
router.get('/billing/offerings', getOfferingsHandler);
router.get('/billing/usage', getUsageHandler);
router.get('/billing/transactions', validate(listBillingHistorySchema), listTransactionsHandler);
router.get('/billing/payments', validate(listBillingHistorySchema), listPaymentsHandler);
router.get('/billing/usage-charges', validate(listBillingHistorySchema), listUsageChargesHandler);
router.post('/billing/subscription', validate(subscribeSchema), subscribeHandler);
router.post('/billing/credits/purchase', validate(purchaseCreditsSchema), purchaseCreditsHandler);
router.post('/billing/modules/purchase', validate(purchaseModuleSchema), purchaseModuleHandler);
router.post('/billing/pay-per-use/setup', createCardSetupHandler);
router.post('/billing/pay-per-use/card', validate(registerCardSchema), registerCardHandler);
router.patch('/billing/spending-limit', validate(updateSpendingLimitSchema), updateSpendingLimitHandler);

export default router;
