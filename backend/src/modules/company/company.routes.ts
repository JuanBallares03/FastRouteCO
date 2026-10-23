import { Router, type Router as ExpressRouter } from 'express';
import { getCompanyHandler, updateCompanyHandler } from './company.controller.js';
import { updateCompanySchema, getCompanySchema } from './validation.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/auth.js';

const router: ExpressRouter = Router();

router.use(authenticate);

router.get('/', authorize('company_admin', 'supervisor'), validate(getCompanySchema), getCompanyHandler);
router.patch('/', authorize('company_admin'), validate(updateCompanySchema), updateCompanyHandler);

export default router;