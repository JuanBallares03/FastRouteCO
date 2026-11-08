import { Router, type Router as ExpressRouter } from 'express';
import {
  addIncidentMessageHandler,
  createIncidentHandler,
  getIncidentHandler,
  listCompanyIncidentsHandler,
  listDriverIncidentsHandler,
  updateIncidentHandler,
} from './incidents.controller.js';
import {
  addIncidentMessageSchema,
  createIncidentSchema,
  incidentIdSchema,
  listIncidentsSchema,
  updateIncidentSchema,
} from './incidents.validation.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

const router: ExpressRouter = Router();

router.use(authenticate);

router.get(
  '/driver',
  authorize('driver'),
  validate(listIncidentsSchema),
  listDriverIncidentsHandler
);

router.get(
  '/',
  authorize('company_admin', 'supervisor'),
  validate(listIncidentsSchema),
  listCompanyIncidentsHandler
);

router.post(
  '/',
  authorize('driver'),
  validate(createIncidentSchema),
  createIncidentHandler
);

router.get(
  '/:id',
  authorize('driver', 'company_admin', 'supervisor'),
  validate(incidentIdSchema),
  getIncidentHandler
);

router.post(
  '/:id/messages',
  authorize('driver', 'company_admin', 'supervisor'),
  validate(addIncidentMessageSchema),
  addIncidentMessageHandler
);

router.patch(
  '/:id',
  authorize('company_admin', 'supervisor'),
  validate(updateIncidentSchema),
  updateIncidentHandler
);

export default router;
