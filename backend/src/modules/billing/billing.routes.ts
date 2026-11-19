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
import { validate } from '../../middleware/validate.js';
import { createRateLimiter } from '../../lib/rate-limit.js';

const router: ExpressRouter = Router();

const cardSetupLimiter = createRateLimiter({
  limit: 10,
  windowSeconds: 60 * 60,
  keyPrefix: 'billing:card',
  skip: () => process.env.NODE_ENV === 'test',
});

router.get('/', getBillingHandler);
router.get('/offerings', getOfferingsHandler);
router.get('/usage', getUsageHandler);
router.get('/transactions', validate(listBillingHistorySchema), listTransactionsHandler);
router.get('/payments', validate(listBillingHistorySchema), listPaymentsHandler);
router.get('/usage-charges', validate(listBillingHistorySchema), listUsageChargesHandler);
router.post('/subscription', validate(subscribeSchema), subscribeHandler);
router.post('/credits/purchase', validate(purchaseCreditsSchema), purchaseCreditsHandler);
router.post('/modules/purchase', validate(purchaseModuleSchema), purchaseModuleHandler);
router.post('/pay-per-use/setup', cardSetupLimiter, createCardSetupHandler);
router.post(
  '/pay-per-use/card',
  cardSetupLimiter,
  validate(registerCardSchema),
  registerCardHandler
);
router.patch('/spending-limit', validate(updateSpendingLimitSchema), updateSpendingLimitHandler);

export default router;
