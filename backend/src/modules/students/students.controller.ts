import type { NextFunction, Request, Response } from 'express';
import {
  createStudent,
  getSchoolTransportEntitlement,
  listStudents,
  updateStudent,
  updateStudentStatus,
} from './students.service.js';
import type {
  CreateStudentInput,
  ListStudentsInput,
  UpdateStudentInput,
} from './students.validation.js';
import { respondWithError } from '../../middleware/error-handler.js';

interface AuthenticatedRequest extends Request {
  user?: { companyId: string | null };
}

function requireCompanyId(req: AuthenticatedRequest, res: Response): string | null {
  const companyId = req.user?.companyId;
  if (!companyId) {
    res.status(403).json({ message: 'Sin empresa asociada' });
    return null;
  }
  return companyId;
}

export async function getEntitlementHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    res.json(await getSchoolTransportEntitlement(companyId));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function listStudentsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    res.json(
      await listStudents(companyId, req.query as unknown as ListStudentsInput)
    );
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function createStudentHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    res.status(201).json(
      await createStudent(companyId, req.body as CreateStudentInput)
    );
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function updateStudentHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params as { id: string };
    res.json(
      await updateStudent(companyId, id, req.body as UpdateStudentInput)
    );
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function updateStudentStatusHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params as { id: string };
    const { isActive } = req.body as { isActive: boolean };
    res.json(await updateStudentStatus(companyId, id, isActive));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}
