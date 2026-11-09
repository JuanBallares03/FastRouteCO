import type { NextFunction, Request, Response } from 'express';
import { getCompanyDashboard, getReportSummary } from './reports.service.js';
import type { ReportSummaryInput } from './reports.validation.js';
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

export async function getDashboardHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    res.json(await getCompanyDashboard(companyId));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function getReportsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    res.json(await getReportSummary(companyId, req.query as unknown as ReportSummaryInput));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function getRouteReportsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const summary = await getReportSummary(
      companyId,
      req.query as unknown as ReportSummaryInput
    );
    res.json({
      range: summary.range,
      driverRanking: summary.driverRanking,
      routes: summary.routes,
    });
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}
