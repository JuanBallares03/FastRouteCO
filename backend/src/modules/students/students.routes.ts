import { Router, type Router as ExpressRouter } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createStudentHandler,
  getEntitlementHandler,
  listStudentsHandler,
  updateStudentHandler,
  updateStudentStatusHandler,
} from './students.controller.js';
import {
  createStudentSchema,
  listStudentsSchema,
  updateStudentSchema,
  updateStudentStatusSchema,
} from './students.validation.js';

const router: ExpressRouter = Router();

router.use(authenticate);
router.use(authorize('company_admin', 'supervisor'));

router.get('/students/entitlement', getEntitlementHandler);
router.get('/students', validate(listStudentsSchema), listStudentsHandler);
router.post('/students', validate(createStudentSchema), createStudentHandler);
router.patch('/students/:id', validate(updateStudentSchema), updateStudentHandler);
router.patch(
  '/students/:id/status',
  validate(updateStudentStatusSchema),
  updateStudentStatusHandler
);

export default router;
