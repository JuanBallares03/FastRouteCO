import type { NextFunction, Request, Response } from 'express';
import { SupportStatus } from '@prisma/client';
import {
  closeSupportRequest,
  createSupportRequest,
  listCompanySupportRequests,
  listPlatformSupportRequests,
  respondToSupportRequest,
} from './support.service.js';
import type {
  CreateSupportRequestInput,
  ListSupportRequestsInput,
  RespondSupportRequestInput,
} from './support.validation.js';
import { respondWithError } from '../../middleware/error-handler.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    companyId: string | null;
  };
}

function requireCompanyId(req: AuthenticatedRequest, res: Response): string | null {
  const companyId = req.user?.companyId;
  if (!companyId) {
    res.status(403).json({ message: 'Sin empresa asociada' });
    return null;
  }
  return companyId;
}

export async function createSupportRequestHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const created = await createSupportRequest(
      companyId,
      req.body as CreateSupportRequestInput
    );
    res.status(201).json(created);
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function listCompanySupportRequestsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const filters = req.query as unknown as ListSupportRequestsInput;
    res.json(
      await listCompanySupportRequests(companyId, {
        ...filters,
        status: filters.status as SupportStatus | undefined,
      })
    );
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function listPlatformSupportRequestsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const filters = req.query as unknown as ListSupportRequestsInput;
    res.json(
      await listPlatformSupportRequests({
        ...filters,
        status: filters.status as SupportStatus | undefined,
      })
    );
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function respondSupportRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params as { id: string };
    res.json(await respondToSupportRequest(id, req.body as RespondSupportRequestInput));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function closeSupportRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params as { id: string };
    res.json(await closeSupportRequest(id));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}
