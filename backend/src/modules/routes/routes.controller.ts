import type { NextFunction, Request, Response } from 'express';
import { RouteStatus } from '@prisma/client';
import {
  assignOrder,
  createRoute,
  getRouteById,
  listRoutes,
  optimizeRoute,
  suggestDrivers,
} from './routes.service.js';
import type { AssignOrderInput, CreateRouteInput } from './validation.js';
import { respondWithError } from '../../middleware/error-handler.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    companyId: string | null;
    isActive: boolean;
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

export async function createRouteHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const route = await createRoute(companyId, req.body as CreateRouteInput);
    res.status(201).json(route);
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function listRoutesHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { date, driverId, status, page, pageSize } = req.query as {
      date?: string;
      driverId?: string;
      status?: string;
      page?: string;
      pageSize?: string;
    };

    res.json(
      await listRoutes(companyId, {
        date,
        driverId,
        status: status as RouteStatus | undefined,
        page: parseInt(page ?? '1', 10),
        pageSize: parseInt(pageSize ?? '20', 10),
      })
    );
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function getRouteHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params as { id: string };
    res.json(await getRouteById(companyId, id));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function suggestDriversHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params as { id: string };
    res.json(await suggestDrivers(companyId, id));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function assignOrderHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params as { id: string };
    res.json(await assignOrder(companyId, id, req.body as AssignOrderInput));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function optimizeRouteHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params as { id: string };
    res.json(await optimizeRoute(companyId, id));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}
