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
import { respondWithError } from '../../middleware/error-handler.js';

export async function createCompanyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const company = await createCompany(req.body);
    res.status(201).json(company);
  } catch (error) {
    if (respondWithError(error, res)) return;
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
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function listCompanyAdminsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const admins = await listCompanyAdmins(id);
    res.json(admins);
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function createCompanyAdminHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const { user, invitationUrl } = await createCompanyAdmin(id, req.body);
    res.status(201).json({ user, invitationUrl });
  } catch (error) {
    if (respondWithError(error, res)) return;
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
    if (respondWithError(error, res)) return;
    next(error);
  }
}