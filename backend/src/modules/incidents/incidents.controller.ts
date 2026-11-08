import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';
import {
  addIncidentMessage,
  createIncident,
  getIncident,
  listCompanyIncidents,
  listDriverIncidents,
  updateIncident,
} from './incidents.service.js';
import type {
  AddIncidentMessageInput,
  CreateIncidentInput,
  ListIncidentsInput,
  UpdateIncidentInput,
} from './incidents.validation.js';
import { respondWithError } from '../../middleware/error-handler.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
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

export async function createIncidentHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId || !req.user) return;

    const incident = await createIncident(
      companyId,
      req.user.id,
      req.body as CreateIncidentInput
    );
    res.status(201).json(incident);
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function listCompanyIncidentsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const incidents = await listCompanyIncidents(
      companyId,
      req.query as unknown as ListIncidentsInput
    );
    res.json(incidents);
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function listDriverIncidentsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId || !req.user) return;

    const incidents = await listDriverIncidents(
      companyId,
      req.user.id,
      req.query as unknown as ListIncidentsInput
    );
    res.json(incidents);
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function getIncidentHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId || !req.user) return;

    const { id } = req.params as { id: string };
    const incident = await getIncident(
      companyId,
      id,
      req.user.id,
      req.user.role
    );
    res.json(incident);
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function addIncidentMessageHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId || !req.user) return;

    const { id } = req.params as { id: string };
    const result = await addIncidentMessage(
      companyId,
      id,
      req.user.id,
      req.user.role,
      req.body as AddIncidentMessageInput
    );
    res.status(201).json(result);
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function updateIncidentHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params as { id: string };
    const incident = await updateIncident(
      companyId,
      id,
      req.body as UpdateIncidentInput
    );
    res.json(incident);
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}
