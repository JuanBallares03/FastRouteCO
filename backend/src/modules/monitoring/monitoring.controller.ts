import type { NextFunction, Request, Response } from 'express';
import type { AlertSeverity } from '@prisma/client';
import { getPlatformOverview, listAlerts, resolveAlert } from './monitoring.service.js';
import type { ListAlertsInput } from './monitoring.validation.js';
import { respondWithError } from '../../middleware/error-handler.js';

export async function getPlatformOverviewHandler(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    res.json(await getPlatformOverview());
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function listAlertsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const filters = req.query as unknown as ListAlertsInput;
    res.json(
      await listAlerts({
        ...filters,
        severity: filters.severity as AlertSeverity | undefined,
      })
    );
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function resolveAlertHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params as { id: string };
    res.json(await resolveAlert(id));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}
