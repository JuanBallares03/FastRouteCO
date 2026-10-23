import { Router, type Router as ExpressRouter } from 'express';
import {
  createCompanyHandler,
  listCompaniesHandler,
  getCompanyHandler,
  updateCompanyStatusHandler,
  listCompanyAdminsHandler,
  createCompanyAdminHandler,
  updateCompanyAdminStatusHandler,
} from './companies.controller.js';
import {
  createCompanySchema,
  updateCompanyStatusSchema,
  listCompaniesSchema,
  getCompanySchema,
  createCompanyAdminSchema,
  updateCompanyAdminStatusSchema,
  listCompanyAdminsSchema,
} from './validation.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/auth.js';

const router: ExpressRouter = Router();

router.use(authenticate);
router.use(authorize('platform_admin'));

router.post('/companies', validate(createCompanySchema), createCompanyHandler);
router.get('/companies', validate(listCompaniesSchema), listCompaniesHandler);
router.get('/companies/:id', validate(getCompanySchema), getCompanyHandler);
router.patch('/companies/:id/status', validate(updateCompanyStatusSchema), updateCompanyStatusHandler);
router.get('/companies/:id/admins', validate(listCompanyAdminsSchema), listCompanyAdminsHandler);
router.post('/companies/:id/admins', validate(createCompanyAdminSchema), createCompanyAdminHandler);
router.patch('/companies/:id/admins/:adminId/status', validate(updateCompanyAdminStatusSchema), updateCompanyAdminStatusHandler);

export default router;