import { Request, Response, NextFunction } from 'express';
import { CompanyStatus, SubscriptionStatus } from '@prisma/client';
import {
  createCompany,
  listCompanies,
  getCompanyById,
  updateCompanyStatus,
  listCompanyAdmins,
  createCompanyAdmin,
  updateCompanyAdminStatus,
} from './companies.service.js';

export async function createCompanyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const company = await createCompany(req.body);
    res.status(201).json(company);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'La empresa debe tener flota propia') {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error.message === 'El NIT ya está registrado') {
        res.status(409).json({ message: error.message });
        return;
      }
      if (error.message === 'No hay plan de prueba gratuita disponible') {
        res.status(500).json({ message: error.message });
        return;
      }
    }
    next(error);
  }
}

export async function listCompaniesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyStatus, subscriptionStatus, planId, search, page, pageSize } = req.query as {
      companyStatus?: string;
      subscriptionStatus?: string;
      planId?: string;
      search?: string;
      page?: string;
      pageSize?: string;
    };

    const result = await listCompanies({
      companyStatus: companyStatus as CompanyStatus | undefined,
      subscriptionStatus: subscriptionStatus as SubscriptionStatus | undefined,
      planId,
      search,
      page: parseInt(page ?? '1', 10),
      pageSize: parseInt(pageSize ?? '20', 10),
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCompanyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const company = await getCompanyById(id);

    if (!company) {
      res.status(404).json({ message: 'Empresa no encontrada' });
      return;
    }

    res.json(company);
  } catch (error) {
    next(error);
  }
}

export async function updateCompanyStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const { isActive } = req.body;

    const result = await updateCompanyStatus(id, isActive);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Empresa no encontrada') {
      res.status(404).json({ message: error.message });
      return;
    }
    next(error);
  }
}

export async function listCompanyAdminsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const admins = await listCompanyAdmins(id);
    res.json(admins);
  } catch (error) {
    if (error instanceof Error && error.message === 'Empresa no encontrada') {
      res.status(404).json({ message: error.message });
      return;
    }
    next(error);
  }
}

export async function createCompanyAdminHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const { user, invitationUrl } = await createCompanyAdmin(id, req.body);
    res.status(201).json({ user, invitationUrl });
  } catch (error) {
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

export async function updateCompanyAdminStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, adminId } = req.params as { id: string; adminId: string };
    const { isActive } = req.body;

    const result = await updateCompanyAdminStatus(id, adminId, isActive);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Administrador no encontrado') {
      res.status(404).json({ message: error.message });
      return;
    }
    next(error);
  }
}