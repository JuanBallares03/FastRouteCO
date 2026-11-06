import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';

type DecimalInput = Prisma.Decimal | number | string | null | undefined;

export interface PlanInput {
  name?: string;
  modality?: 'subscription' | 'pay_per_use';
  maxDrivers?: number | null;
  maxBranches?: number | null;
  supportType?: string | null;
  trialDays?: number | null;
  monthlyCredits?: number | null;
  monthlyPrice?: DecimalInput;
  annualPrice?: DecimalInput;
  includedDrivers?: number | null;
  pricePerOptimization?: DecimalInput;
  pricePerAdditionalDriver?: DecimalInput;
  earlyChargeThreshold?: DecimalInput;
  isActive?: boolean;
  moduleIds?: string[];
}

export interface ModuleInput {
  code?: string;
  name?: string;
  price?: DecimalInput;
  isActive?: boolean;
}

export interface CreditPackageInput {
  name?: string;
  credits?: number;
  price?: Prisma.Decimal | number | string;
  isActive?: boolean;
}

const planInclude = {
  planModules: { include: { module: true } },
} satisfies Prisma.PlanInclude;

function serializePlan(plan: Prisma.PlanGetPayload<{ include: typeof planInclude }>) {
  return {
    ...plan,
    monthlyPrice: plan.monthlyPrice === null ? null : Number(plan.monthlyPrice),
    annualPrice: plan.annualPrice === null ? null : Number(plan.annualPrice),
    pricePerOptimization:
      plan.pricePerOptimization === null ? null : Number(plan.pricePerOptimization),
    pricePerAdditionalDriver:
      plan.pricePerAdditionalDriver === null
        ? null
        : Number(plan.pricePerAdditionalDriver),
    earlyChargeThreshold:
      plan.earlyChargeThreshold === null ? null : Number(plan.earlyChargeThreshold),
    modules: plan.planModules.map((entry) => entry.module),
  };
}

function serializePackage(pkg: Prisma.CreditPackageGetPayload<Record<string, never>>) {
  return { ...pkg, price: Number(pkg.price) };
}

function serializeModule(module: Prisma.ModuleGetPayload<Record<string, never>>) {
  return { ...module, price: module.price === null ? null : Number(module.price) };
}

function planData(data: PlanInput) {
  return {
    name: data.name,
    modality: data.modality,
    maxDrivers: data.maxDrivers,
    maxBranches: data.maxBranches,
    supportType: data.supportType,
    trialDays: data.trialDays,
    monthlyCredits: data.monthlyCredits,
    monthlyPrice: data.monthlyPrice,
    annualPrice: data.annualPrice,
    includedDrivers: data.includedDrivers,
    pricePerOptimization: data.pricePerOptimization,
    pricePerAdditionalDriver: data.pricePerAdditionalDriver,
    earlyChargeThreshold: data.earlyChargeThreshold,
    isActive: data.isActive,
  };
}

function uniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function listPlans(includeInactive = false) {
  const plans = await prisma.plan.findMany({
    where: includeInactive ? undefined : { isActive: true },
    include: planInclude,
    orderBy: [{ modality: 'asc' }, { monthlyPrice: 'asc' }, { name: 'asc' }],
  });
  return plans.map(serializePlan);
}

export async function createPlan(data: PlanInput) {
  if (!data.name) throw new ConflictError('El nombre del plan es obligatorio');
  try {
    const plan = await prisma.plan.create({
      data: {
        name: data.name,
        modality: data.modality ?? 'subscription',
        maxDrivers: data.maxDrivers,
        maxBranches: data.maxBranches,
        supportType: data.supportType,
        trialDays: data.trialDays,
        monthlyCredits: data.monthlyCredits,
        monthlyPrice: data.monthlyPrice,
        annualPrice: data.annualPrice,
        includedDrivers: data.includedDrivers,
        pricePerOptimization: data.pricePerOptimization,
        pricePerAdditionalDriver: data.pricePerAdditionalDriver,
        earlyChargeThreshold: data.earlyChargeThreshold,
        isActive: data.isActive ?? true,
        planModules: data.moduleIds
          ? { create: data.moduleIds.map((moduleId) => ({ moduleId })) }
          : undefined,
      },
      include: planInclude,
    });
    return serializePlan(plan);
  } catch (error) {
    if (uniqueViolation(error)) {
      throw new ConflictError('Ya existe un plan con ese nombre');
    }
    throw error;
  }
}

export async function updatePlan(id: string, data: PlanInput) {
  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Plan no encontrado', 'PLAN_NOT_FOUND');

  try {
    const plan = await prisma.plan.update({
      where: { id },
      data: {
        ...planData(data),
        ...(data.moduleIds !== undefined
          ? {
              planModules: {
                deleteMany: {},
                create: data.moduleIds.map((moduleId) => ({ moduleId })),
              },
            }
          : {}),
      },
      include: planInclude,
    });
    return serializePlan(plan);
  } catch (error) {
    if (uniqueViolation(error)) {
      throw new ConflictError('Ya existe un plan con ese nombre');
    }
    throw error;
  }
}

export async function listModules(includeInactive = false) {
  const modules = await prisma.module.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: 'asc' },
  });
  return modules.map(serializeModule);
}

export async function createModule(data: ModuleInput) {
  if (!data.code || !data.name) {
    throw new ConflictError('El código y el nombre del módulo son obligatorios');
  }
  try {
    return serializeModule(
      await prisma.module.create({
        data: {
          code: data.code,
          name: data.name,
          price: data.price,
          isActive: data.isActive ?? true,
        },
      })
    );
  } catch (error) {
    if (uniqueViolation(error)) {
      throw new ConflictError('Ya existe un módulo con ese código');
    }
    throw error;
  }
}

export async function updateModule(id: string, data: ModuleInput) {
  const existing = await prisma.module.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Módulo no encontrado', 'MODULE_NOT_FOUND');

  try {
    return serializeModule(
      await prisma.module.update({
        where: { id },
        data: {
          code: data.code,
          name: data.name,
          price: data.price,
          isActive: data.isActive,
        },
      })
    );
  } catch (error) {
    if (uniqueViolation(error)) {
      throw new ConflictError('Ya existe un módulo con ese código');
    }
    throw error;
  }
}

export async function listCreditPackages(includeInactive = false) {
  const packages = await prisma.creditPackage.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { credits: 'asc' },
  });
  return packages.map(serializePackage);
}

export async function createCreditPackage(data: CreditPackageInput) {
  if (!data.name || data.credits === undefined || data.price === undefined) {
    throw new ConflictError('El nombre, los créditos y el precio son obligatorios');
  }
  return serializePackage(
    await prisma.creditPackage.create({
      data: {
        name: data.name,
        credits: data.credits,
        price: data.price,
        isActive: data.isActive ?? true,
      },
    })
  );
}

export async function updateCreditPackage(id: string, data: CreditPackageInput) {
  const existing = await prisma.creditPackage.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Paquete de créditos no encontrado', 'PACKAGE_NOT_FOUND');
  }

  return serializePackage(
    await prisma.creditPackage.update({
      where: { id },
      data: {
        name: data.name,
        credits: data.credits,
        price: data.price,
        isActive: data.isActive,
      },
    })
  );
}
