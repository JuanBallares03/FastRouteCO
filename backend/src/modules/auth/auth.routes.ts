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
  validate,
} from './validation.middleware.js';
import { authenticate } from '../../middleware/auth.js';

const router: ExpressRouter = Router();

router.post('/login', validate(loginSchema), login);
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/logout', validate(logoutSchema), logout);
router.post('/accept-invitation', validate(acceptInvitationSchema), acceptInvitationHandler);
router.get('/me', authenticate, me);
router.post('/resend-invitation/:userId', validate(resendInvitationSchema), resendInvitationHandler);

export default router;