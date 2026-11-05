import type { Response } from 'express';
import { AppError } from '../lib/errors.js';

export function respondWithError(error: unknown, res: Response): boolean {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ message: error.message, code: error.code });
    return true;
  }
  return false;
}
