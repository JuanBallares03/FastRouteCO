import { Router, type Router as ExpressRouter } from 'express';
import {
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
  acceptInvitationHandler,
  resendInvitationHandler,
} from './auth.controller.js';
import {
  loginSchema,
  refreshSchema,
  acceptInvitationSchema,
  logoutSchema,
  resendInvitationSchema,
} from './auth.validation.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createRateLimiter } from '../../lib/rate-limit.js';

const router: ExpressRouter = Router();

const skipInTests = () => process.env.NODE_ENV === 'test';

const loginLimiter = createRateLimiter({
  limit: 20,
  windowSeconds: 15 * 60,
  keyPrefix: 'auth:login',
  skip: skipInTests,
});
const refreshLimiter = createRateLimiter({
  limit: 120,
  windowSeconds: 15 * 60,
  keyPrefix: 'auth:refresh',
  skip: skipInTests,
});
const invitationLimiter = createRateLimiter({
  limit: 10,
  windowSeconds: 60 * 60,
  keyPrefix: 'auth:invitation',
  skip: skipInTests,
});

router.post('/login', loginLimiter, validate(loginSchema), loginHandler);
router.post('/refresh', refreshLimiter, validate(refreshSchema), refreshHandler);
router.post('/logout', validate(logoutSchema), logoutHandler);
router.post(
  '/accept-invitation',
  invitationLimiter,
  validate(acceptInvitationSchema),
  acceptInvitationHandler
);
router.get('/me', authenticate, meHandler);
router.post(
  '/resend-invitation/:userId',
  invitationLimiter,
  authenticate,
  authorize('platform_admin', 'company_admin'),
  validate(resendInvitationSchema),
  resendInvitationHandler
);

export default router;