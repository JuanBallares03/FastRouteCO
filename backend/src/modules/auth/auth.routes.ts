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
  loginValidation,
  refreshValidation,
  acceptInvitationValidation,
  logoutValidation,
  resendInvitationValidation,
} from './validation.middleware.js';
import { authenticate } from '../../middleware/auth.js';

const router: ExpressRouter = Router();

router.post('/login', loginValidation, login);
router.post('/refresh', refreshValidation, refresh);
router.post('/logout', logoutValidation, logout);
router.post('/accept-invitation', acceptInvitationValidation, acceptInvitationHandler);
router.get('/me', authenticate, me);
router.post('/resend-invitation/:userId', resendInvitationValidation, resendInvitationHandler);

export default router;