import { Router, type Router as ExpressRouter } from 'express';
import {
  login,
  refresh,
  logout,
  me,
  acceptInvitationHandler,
  resendInvitationHandler,
} from './auth.controller.js';
import {
  loginSchema,
  refreshSchema,
  acceptInvitationSchema,
  logoutSchema,
  resendInvitationSchema,
} from './validation.middleware.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createRateLimiter } from '../../lib/rate-limit.js';

const router: ExpressRouter = Router();

const loginLimiter = createRateLimiter({
  limit: 20,
  windowSeconds: 15 * 60,
  keyPrefix: 'auth:login',
});
const refreshLimiter = createRateLimiter({
  limit: 120,
  windowSeconds: 15 * 60,
  keyPrefix: 'auth:refresh',
});
const invitationLimiter = createRateLimiter({
  limit: 10,
  windowSeconds: 60 * 60,
  keyPrefix: 'auth:invitation',
});

router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/refresh', refreshLimiter, validate(refreshSchema), refresh);
router.post('/logout', validate(logoutSchema), logout);
router.post(
  '/accept-invitation',
  invitationLimiter,
  validate(acceptInvitationSchema),
  acceptInvitationHandler
);
router.get('/me', authenticate, me);
router.post(
  '/resend-invitation/:userId',
  invitationLimiter,
  authenticate,
  authorize('platform_admin', 'company_admin'),
  validate(resendInvitationSchema),
  resendInvitationHandler
);

export default router;