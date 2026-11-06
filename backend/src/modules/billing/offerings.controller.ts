import type { NextFunction, Request, Response } from 'express';
import {
  createCreditPackage,
  createModule,
  createPlan,
  listCreditPackages,
  listModules,
  listPlans,
  updateCreditPackage,
  updateModule,
  updatePlan,
} from './offerings.service.js';
import type { ModuleBody, PackageBody, PlanBody } from './offerings.validation.js';
import { respondWithError } from '../../middleware/error-handler.js';

function includeInactive(req: Request): boolean {
  return req.query.includeInactive === 'true';
}

export async function listPlansHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listPlans(includeInactive(req)));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function createPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await createPlan(req.body as PlanBody));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function updatePlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await updatePlan(id, req.body as Partial<PlanBody>));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function listModulesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listModules(includeInactive(req)));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function createModuleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await createModule(req.body as ModuleBody));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function updateModuleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await updateModule(id, req.body as Partial<ModuleBody>));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function listPackagesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listCreditPackages(includeInactive(req)));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function createPackageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await createCreditPackage(req.body as PackageBody));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function updatePackageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    res.json(await updateCreditPackage(id, req.body as Partial<PackageBody>));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}
