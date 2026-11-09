import type { NextFunction, Request, Response } from 'express';
import { AlertSeverity } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { recordSystemAlert } from '../lib/alerts.js';

export function respondWithError(error: unknown, res: Response): boolean {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ message: error.message, code: error.code });
    return true;
  }
  return false;
}

interface ErrorRequest extends Request {
  user?: { companyId?: string | null };
}

export function errorHandler(
  error: unknown,
  req: ErrorRequest,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const statusCode = error instanceof AppError ? error.statusCode : 500;
  if (statusCode >= 500) {
    const message = error instanceof Error ? error.message : 'Error interno';
    void recordSystemAlert({
      companyId: req.user?.companyId ?? null,
      severity: AlertSeverity.critical,
      source: 'api',
      message: `${req.method} ${req.originalUrl}: ${message}`,
    }).catch((alertError) => {
      console.error('[alerts] Failed to record system alert:', alertError);
    });
  }

  const message =
    error instanceof AppError
      ? error.message
      : statusCode >= 500
        ? 'Error interno del servidor'
        : 'Solicitud inválida';

  res.status(statusCode).json({
    message,
    ...(error instanceof AppError && error.code ? { code: error.code } : {}),
  });
}
