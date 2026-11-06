import { Router, type Router as ExpressRouter } from 'express';
import {
  createModuleHandler,
  createPackageHandler,
  createPlanHandler,
  listModulesHandler,
  listPackagesHandler,
  listPlansHandler,
  updateModuleHandler,
  updatePackageHandler,
  updatePlanHandler,
} from './offerings.controller.js';
import {
  createModuleSchema,
  createPackageSchema,
  createPlanSchema,
  listModulesSchema,
  listPackagesSchema,
  listPlansSchema,
  updateModuleSchema,
  updatePackageSchema,
  updatePlanSchema,
} from './offerings.validation.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

const router: ExpressRouter = Router();

router.use(authenticate);
router.use(authorize('platform_admin'));

router.get('/plans', validate(listPlansSchema), listPlansHandler);
router.post('/plans', validate(createPlanSchema), createPlanHandler);
router.patch('/plans/:id', validate(updatePlanSchema), updatePlanHandler);

router.get('/modules', validate(listModulesSchema), listModulesHandler);
router.post('/modules', validate(createModuleSchema), createModuleHandler);
router.patch('/modules/:id', validate(updateModuleSchema), updateModuleHandler);

router.get('/credit-packages', validate(listPackagesSchema), listPackagesHandler);
router.post('/credit-packages', validate(createPackageSchema), createPackageHandler);
router.patch('/credit-packages/:id', validate(updatePackageSchema), updatePackageHandler);

export default router;
