import { Router, type Router as ExpressRouter } from 'express';
import { wompiCardHandler, wompiEventsHandler } from './payments.controller.js';

const router: ExpressRouter = Router();

router.post('/wompi/events', wompiEventsHandler);
router.post('/wompi/card', wompiCardHandler);

export default router;
