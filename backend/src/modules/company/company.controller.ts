import { Request, Response, NextFunction } from 'express';
import { getCompanyById, updateCompany } from './company.service.js';

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