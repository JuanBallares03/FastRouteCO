import { Router } from 'express';
import { checkHealth, type HealthCheckers } from '../../lib/health.js';

export function createHealthRouter(checkers?: HealthCheckers): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const report = await checkHealth(checkers);
    res.status(report.status === 'error' ? 503 : 200).json(report);
  });

  return router;
}

export default createHealthRouter();
