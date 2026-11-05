import { Request, Response, NextFunction } from 'express';
import {
  getCompanyById,
  updateCompany,
  listBranches,
  createBranch,
  updateBranch,
  listSupervisors,
  createSupervisor,
  updateSupervisorStatus,
  listDrivers,
  createDriver,
  updateDriver,
  updateDriverStatus,
  updateDriverAvailability,
  NotFoundError,
  ConflictError,
  PlanLimitError,
} from './company.service.js';
import { DriverStatus } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    companyId: string | null;
    isActive: boolean;
    companyStatus?: string;
  };
}

export async function getCompanyHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(403).json({ message: 'Sin empresa asociada' });
      return;
    }

    const company = await getCompanyById(companyId);
    if (!company) {
      res.status(404).json({ message: 'Empresa no encontrada' });
      return;
    }

    res.json(company);
  } catch (error) {
    next(error);
  }
}

export async function updateCompanyHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(403).json({ message: 'Sin empresa asociada' });
      return;
    }

    const company = await updateCompany(companyId, req.body);
    res.json(company);
  } catch (error) {
    console.error('[updateCompanyHandler] Error:', error);
    if (error instanceof Error) {
      if (error.message === 'Empresa no encontrada') {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error.message === 'El email ya está registrado') {
        res.status(409).json({ message: error.message });
        return;
      }
    }
    next(error);
  }
}

function handleServiceError(error: unknown, res: Response): boolean {
  if (error instanceof NotFoundError) {
    res.status(404).json({ message: error.message });
    return true;
  }
  if (error instanceof ConflictError) {
    res.status(409).json({ message: error.message });
    return true;
  }
  if (error instanceof PlanLimitError) {
    res.status(400).json({ message: error.message });
    return true;
  }
  return false;
}

export async function listBranchesHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(403).json({ message: 'Sin empresa asociada' });
      return;
    }

    res.json(await listBranches(companyId));
  } catch (error) {
    next(error);
  }
}

export async function createBranchHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(403).json({ message: 'Sin empresa asociada' });
      return;
    }

    const branch = await createBranch(companyId, req.body);
    res.status(201).json(branch);
  } catch (error) {
    if (handleServiceError(error, res)) return;
    next(error);
  }
}

export async function updateBranchHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(403).json({ message: 'Sin empresa asociada' });
      return;
    }

    const { id } = req.params as { id: string };
    const branch = await updateBranch(companyId, id, req.body);
    res.json(branch);
  } catch (error) {
    if (handleServiceError(error, res)) return;
    next(error);
  }
}

export async function listSupervisorsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(403).json({ message: 'Sin empresa asociada' });
      return;
    }

    res.json(await listSupervisors(companyId));
  } catch (error) {
    next(error);
  }
}

export async function createSupervisorHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(403).json({ message: 'Sin empresa asociada' });
      return;
    }

    const result = await createSupervisor(companyId, req.body);
    res.status(201).json(result);
  } catch (error) {
    if (handleServiceError(error, res)) return;
    next(error);
  }
}

export async function updateSupervisorStatusHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(403).json({ message: 'Sin empresa asociada' });
      return;
    }

    const { id } = req.params as { id: string };
    res.json(await updateSupervisorStatus(companyId, id, req.body.isActive));
  } catch (error) {
    if (handleServiceError(error, res)) return;
    next(error);
  }
}

export async function listDriversHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(403).json({ message: 'Sin empresa asociada' });
      return;
    }

    res.json(await listDrivers(companyId));
  } catch (error) {
    next(error);
  }
}

export async function createDriverHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(403).json({ message: 'Sin empresa asociada' });
      return;
    }

    const result = await createDriver(companyId, req.body);
    res.status(201).json(result);
  } catch (error) {
    if (handleServiceError(error, res)) return;
    next(error);
  }
}

export async function updateDriverHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(403).json({ message: 'Sin empresa asociada' });
      return;
    }

    const { id } = req.params as { id: string };
    res.json(await updateDriver(companyId, id, req.body));
  } catch (error) {
    if (handleServiceError(error, res)) return;
    next(error);
  }
}

export async function updateDriverStatusHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(403).json({ message: 'Sin empresa asociada' });
      return;
    }

    const { id } = req.params as { id: string };
    res.json(await updateDriverStatus(companyId, id, req.body.isActive));
  } catch (error) {
    if (handleServiceError(error, res)) return;
    next(error);
  }
}

export async function updateDriverAvailabilityHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(403).json({ message: 'Sin empresa asociada' });
      return;
    }

    const { id } = req.params as { id: string };
    res.json(await updateDriverAvailability(companyId, id, req.body.status as DriverStatus));
  } catch (error) {
    if (handleServiceError(error, res)) return;
    next(error);
  }
}