import type { NextFunction, Request, Response } from 'express';
import { listSystemSettings, updateSystemSettings } from './settings.service.js';
import type { UpdateSystemSettingsInput } from './settings.validation.js';
import { respondWithError } from '../../middleware/error-handler.js';

export async function listSettingsHandler(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    res.json(await listSystemSettings());
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function updateSettingsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    res.json(await updateSystemSettings(req.body as UpdateSystemSettingsInput));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}
