import { z } from 'zod';

const money = z.coerce.number().nonnegative().max(9_999_999_999);
const planModality = z.enum(['subscription', 'pay_per_use']);

const planFields = {
  name: z.string().min(1, { message: 'Nombre del plan requerido' }).max(50),
  modality: planModality,
  maxDrivers: z.coerce.number().int().positive().nullable(),
  maxBranches: z.coerce.number().int().positive().nullable(),
  supportType: z.string().max(50).nullable(),
  trialDays: z.coerce.number().int().nonnegative().nullable(),
  monthlyCredits: z.coerce.number().int().nonnegative().nullable(),
  monthlyPrice: money.nullable(),
  annualPrice: money.nullable(),
  includedDrivers: z.coerce.number().int().nonnegative().nullable(),
  pricePerOptimization: money.nullable(),
  pricePerAdditionalDriver: money.nullable(),
  earlyChargeThreshold: money.nullable(),
  isActive: z.boolean(),
  moduleIds: z.array(z.string().uuid()).max(50),
};

export const createPlanSchema = z.object({
  body: z.object(planFields),
});

export const updatePlanSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object(planFields).partial(),
});

export const listPlansSchema = z.object({
  query: z.object({
    includeInactive: z.enum(['true', 'false']).optional(),
  }),
});

const moduleFields = {
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  price: money.nullable(),
  isActive: z.boolean(),
};

export const createModuleSchema = z.object({
  body: z.object(moduleFields),
});

export const updateModuleSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object(moduleFields).partial(),
});

export const listModulesSchema = z.object({
  query: z.object({
    includeInactive: z.enum(['true', 'false']).optional(),
  }),
});

const packageFields = {
  name: z.string().min(1).max(100),
  credits: z.coerce.number().int().positive(),
  price: money,
  isActive: z.boolean(),
};

export const createPackageSchema = z.object({
  body: z.object(packageFields),
});

export const updatePackageSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object(packageFields).partial(),
});

export const listPackagesSchema = z.object({
  query: z.object({
    includeInactive: z.enum(['true', 'false']).optional(),
  }),
});

export type PlanBody = z.infer<typeof createPlanSchema>['body'];
export type ModuleBody = z.infer<typeof createModuleSchema>['body'];
export type PackageBody = z.infer<typeof createPackageSchema>['body'];
