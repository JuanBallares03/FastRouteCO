import type { NextFunction, Request, Response } from 'express';
import { BillingCycle } from '@prisma/client';
import {
  createCardSetupToken,
  getBillingOverview,
  getUsageSummary,
  listCreditTransactions,
  listOfferings,
  listPayments,
  listUsageCharges,
  registerCardAndStartPayPerUse,
  startCreditPackageCheckout,
  startModuleCheckout,
  startSubscriptionCheckout,
  updateSpendingLimit,
} from './billing.service.js';
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

function companyId(req: AuthenticatedRequest, res: Response): string | null {
  if (!req.user?.companyId) {
    res.status(403).json({ message: 'Sin empresa asociada' });
    return null;
  }
  return req.user.companyId;
}

function pageParams(req: Request) {
  const { page, pageSize } = req.query as { page?: string; pageSize?: string };
  return {
    page: parseInt(page ?? '1', 10),
    pageSize: parseInt(pageSize ?? '20', 10),
  };
}

export async function getBillingHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = companyId(req, res);
    if (!id) return;
    res.json(await getBillingOverview(id));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function getOfferingsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = companyId(req, res);
    if (!id) return;
    res.json(await listOfferings());
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function getUsageHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = companyId(req, res);
    if (!id) return;
    res.json(await getUsageSummary(id));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function listTransactionsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = companyId(req, res);
    if (!id) return;
    const { page, pageSize } = pageParams(req);
    res.json(await listCreditTransactions(id, page, pageSize));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function listPaymentsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = companyId(req, res);
    if (!id) return;
    const { page, pageSize } = pageParams(req);
    res.json(await listPayments(id, page, pageSize));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function listUsageChargesHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = companyId(req, res);
    if (!id) return;
    const { page, pageSize } = pageParams(req);
    res.json(await listUsageCharges(id, page, pageSize));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function subscribeHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = companyId(req, res);
    if (!id) return;
    const { planId, billingCycle } = req.body as {
      planId: string;
      billingCycle: BillingCycle;
    };
    res.status(201).json(await startSubscriptionCheckout(id, planId, billingCycle));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function purchaseCreditsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = companyId(req, res);
    if (!id) return;
    const { packageId } = req.body as { packageId: string };
    res.status(201).json(await startCreditPackageCheckout(id, packageId));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function purchaseModuleHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = companyId(req, res);
    if (!id) return;
    const { moduleId } = req.body as { moduleId: string };
    res.status(201).json(await startModuleCheckout(id, moduleId));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function createCardSetupHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = companyId(req, res);
    if (!id) return;
    res.status(201).json({ setupToken: createCardSetupToken(id) });
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function registerCardHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = companyId(req, res);
    if (!id) return;
    const { token } = req.body as { token: string };
    const result = await registerCardAndStartPayPerUse(id, token);
    res.status(result.status === 'APPROVED' ? 201 : 202).json(result);
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function updateSpendingLimitHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = companyId(req, res);
    if (!id) return;
    const { limit } = req.body as { limit: number | null };
    res.json(await updateSpendingLimit(id, limit));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}
