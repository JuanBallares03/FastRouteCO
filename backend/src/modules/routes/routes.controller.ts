import type { NextFunction, Request, Response } from 'express';
import { RouteStatus } from '@prisma/client';
import {
  arriveAtStop,
  assignOrder,
  completeDriverStop,
  createEvidenceSignature,
  createRoute,
  finishDriverRoute,
  getDriverRoute,
  getDriverTodayRoute,
  getLatestRouteLocation,
  getRouteById,
  listRoutes,
  optimizeRoute,
  reassignRoute,
  reassignStop,
  recordRouteLocations,
  startDriverRoute,
  suggestDrivers,
} from './routes.service.js';
import type {
  ArriveAtStopInput,
  AssignOrderInput,
  CompleteStopInput,
  CreateRouteInput,
  ReassignRouteInput,
  RouteLocationsInput,
  StartRouteInput,
} from './routes.validation.js';
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

function requireDriverId(req: AuthenticatedRequest, res: Response): string | null {
  const driverId = req.user?.id;
  if (!driverId) {
    res.status(403).json({ message: 'Sin conductor asociado' });
    return null;
  }
  return driverId;
}

export async function getDriverTodayRouteHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;
    const driverId = requireDriverId(req, res);
    if (!driverId) return;

    res.json(await getDriverTodayRoute(companyId, driverId));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function getDriverRouteHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;
    const driverId = requireDriverId(req, res);
    if (!driverId) return;

    const { id } = req.params as { id: string };
    res.json(await getDriverRoute(companyId, driverId, id));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function startDriverRouteHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;
    const driverId = requireDriverId(req, res);
    if (!driverId) return;

    const { id } = req.params as { id: string };
    res.json(await startDriverRoute(companyId, driverId, id, req.body as StartRouteInput));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function finishDriverRouteHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;
    const driverId = requireDriverId(req, res);
    if (!driverId) return;

    const { id } = req.params as { id: string };
    res.json(await finishDriverRoute(companyId, driverId, id));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function recordRouteLocationsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;
    const driverId = requireDriverId(req, res);
    if (!driverId) return;

    const { id } = req.params as { id: string };
    const { locations } = req.body as RouteLocationsInput;
    res.json(await recordRouteLocations(companyId, driverId, id, locations));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function arriveAtStopHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;
    const driverId = requireDriverId(req, res);
    if (!driverId) return;

    const { id, stopId } = req.params as { id: string; stopId: string };
    res.json(
      await arriveAtStop(companyId, driverId, id, stopId, req.body as ArriveAtStopInput)
    );
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function completeStopHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;
    const driverId = requireDriverId(req, res);
    if (!driverId) return;

    const { id, stopId } = req.params as { id: string; stopId: string };
    res.json(
      await completeDriverStop(companyId, driverId, id, stopId, req.body as CompleteStopInput)
    );
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function createEvidenceSignatureHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;
    const driverId = requireDriverId(req, res);
    if (!driverId) return;

    const { id, stopId } = req.params as { id: string; stopId: string };
    res.json(await createEvidenceSignature(companyId, driverId, id, stopId));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function getLatestRouteLocationHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params as { id: string };
    res.json(await getLatestRouteLocation(companyId, id));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function reassignRouteHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params as { id: string };
    const body = req.body as ReassignRouteInput;
    res.json(await reassignRoute(companyId, id, body.driverId));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function reassignStopHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { id, stopId } = req.params as { id: string; stopId: string };
    const body = req.body as ReassignRouteInput;
    res.json(await reassignStop(companyId, id, stopId, body.driverId));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}
