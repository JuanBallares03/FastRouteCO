import { Router, type Router as ExpressRouter } from 'express';
import {
  arriveAtStopHandler,
  completeStopHandler,
  createEvidenceSignatureHandler,
  createRouteHandler,
  finishDriverRouteHandler,
  getDriverRouteHandler,
  getDriverTodayRouteHandler,
  getLatestRouteLocationHandler,
  getRouteHandler,
  listRoutesHandler,
  optimizeRouteHandler,
  reassignRouteHandler,
  reassignStopHandler,
  recordRouteLocationsHandler,
  startDriverRouteHandler,
} from './routes.controller.js';
import {
  arriveAtStopSchema,
  completeStopSchema,
  createRouteSchema,
  driverRouteSchema,
  finishRouteSchema,
  getRouteSchema,
  listRoutesSchema,
  optimizeRouteSchema,
  reassignRouteSchema,
  reassignStopSchema,
  routeLocationsSchema,
  startRouteSchema,
  stopParamsSchema,
} from './validation.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

const router: ExpressRouter = Router();

router.use(authenticate);

router.get('/driver/today', authorize('driver'), getDriverTodayRouteHandler);
router.get(
  '/driver/:id',
  authorize('driver'),
  validate(driverRouteSchema),
  getDriverRouteHandler
);
router.post(
  '/driver/:id/start',
  authorize('driver'),
  validate(startRouteSchema),
  startDriverRouteHandler
);
router.post(
  '/driver/:id/finish',
  authorize('driver'),
  validate(finishRouteSchema),
  finishDriverRouteHandler
);
router.post(
  '/driver/:id/locations',
  authorize('driver'),
  validate(routeLocationsSchema),
  recordRouteLocationsHandler
);
router.post(
  '/driver/:id/stops/:stopId/arrive',
  authorize('driver'),
  validate(arriveAtStopSchema),
  arriveAtStopHandler
);
router.post(
  '/driver/:id/stops/:stopId/complete',
  authorize('driver'),
  validate(completeStopSchema),
  completeStopHandler
);
router.post(
  '/driver/:id/stops/:stopId/evidence-signature',
  authorize('driver'),
  validate(stopParamsSchema),
  createEvidenceSignatureHandler
);

router.post(
  '/',
  authorize('company_admin', 'supervisor'),
  validate(createRouteSchema),
  createRouteHandler
);
router.get(
  '/',
  authorize('company_admin', 'supervisor'),
  validate(listRoutesSchema),
  listRoutesHandler
);
router.post(
  '/:id/optimize',
  authorize('company_admin', 'supervisor'),
  validate(optimizeRouteSchema),
  optimizeRouteHandler
);
router.get(
  '/:id/locations/latest',
  authorize('company_admin', 'supervisor'),
  validate(getRouteSchema),
  getLatestRouteLocationHandler
);
router.patch(
  '/:id/driver',
  authorize('company_admin', 'supervisor'),
  validate(reassignRouteSchema),
  reassignRouteHandler
);
router.post(
  '/:id/stops/:stopId/reassign',
  authorize('company_admin', 'supervisor'),
  validate(reassignStopSchema),
  reassignStopHandler
);
router.get(
  '/:id',
  authorize('company_admin', 'supervisor'),
  validate(getRouteSchema),
  getRouteHandler
);

export default router;
