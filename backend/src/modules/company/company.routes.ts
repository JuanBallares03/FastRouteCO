import { Router, type Router as ExpressRouter } from 'express';
import {
  getCompanyHandler,
  updateCompanyHandler,
  listBranchesHandler,
  createBranchHandler,
  updateBranchHandler,
  listSupervisorsHandler,
  createSupervisorHandler,
  updateSupervisorStatusHandler,
  listDriversHandler,
  createDriverHandler,
  updateDriverHandler,
  updateDriverStatusHandler,
  updateDriverAvailabilityHandler,
} from './company.controller.js';
import {
  updateCompanySchema,
  getCompanySchema,
  listBranchesSchema,
  createBranchSchema,
  updateBranchSchema,
  listSupervisorsSchema,
  createSupervisorSchema,
  updateSupervisorStatusSchema,
  listDriversSchema,
  createDriverSchema,
  updateDriverSchema,
  updateDriverStatusSchema,
  updateDriverAvailabilitySchema,
} from './validation.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/auth.js';

const router: ExpressRouter = Router();

router.use(authenticate);

router.get('/', authorize('company_admin', 'supervisor'), validate(getCompanySchema), getCompanyHandler);
router.patch('/', authorize('company_admin'), validate(updateCompanySchema), updateCompanyHandler);

router.get('/branches', authorize('company_admin'), validate(listBranchesSchema), listBranchesHandler);
router.post('/branches', authorize('company_admin'), validate(createBranchSchema), createBranchHandler);
router.patch('/branches/:id', authorize('company_admin'), validate(updateBranchSchema), updateBranchHandler);

router.get('/supervisors', authorize('company_admin'), validate(listSupervisorsSchema), listSupervisorsHandler);
router.post('/supervisors', authorize('company_admin'), validate(createSupervisorSchema), createSupervisorHandler);
router.patch('/supervisors/:id/status', authorize('company_admin'), validate(updateSupervisorStatusSchema), updateSupervisorStatusHandler);

router.get('/drivers', authorize('company_admin', 'supervisor'), validate(listDriversSchema), listDriversHandler);
router.post('/drivers', authorize('company_admin', 'supervisor'), validate(createDriverSchema), createDriverHandler);
router.patch('/drivers/:id', authorize('company_admin', 'supervisor'), validate(updateDriverSchema), updateDriverHandler);
router.patch('/drivers/:id/status', authorize('company_admin', 'supervisor'), validate(updateDriverStatusSchema), updateDriverStatusHandler);
router.patch('/drivers/:id/availability', authorize('company_admin', 'supervisor'), validate(updateDriverAvailabilitySchema), updateDriverAvailabilityHandler);

export default router;
