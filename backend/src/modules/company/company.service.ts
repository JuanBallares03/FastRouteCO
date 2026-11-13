import { Prisma, SubscriptionStatus, UserRole, DriverStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { createInvitationForUser, revokeAllUserRefreshTokens } from '../auth/auth.service.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';


async function getActiveSubscription(companyId: string) {
  return prisma.subscription.findFirst({
    where: { companyId, status: SubscriptionStatus.active },
    include: { plan: true },
  });
}

export async function getCompanyById(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      subscriptions: {
        where: { status: SubscriptionStatus.active },
        include: { plan: true },
        take: 1,
      },
      creditBalance: true,
      _count: {
        select: { users: true, branches: true },
      },
    },
  });

  if (!company) return null;

  return {
    ...company,
    activeSubscription: company.subscriptions[0] ?? null,
    usersCount: company._count.users,
    branchesCount: company._count.branches,
  };
}

export async function updateCompany(
  companyId: string,
  data: { email?: string; phone?: string; address?: string; settings?: Prisma.JsonValue }
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    throw new NotFoundError('Empresa no encontrada');
  }

  if (data.email && data.email !== company.email) {
    const existing = await prisma.company.findFirst({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictError('El email ya está registrado');
    }
  }

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      email: data.email,
      phone: data.phone,
      address: data.address,
      settings: data.settings as Prisma.InputJsonValue | undefined,
    },
  });

  return updated;
}
export async function listBranches(companyId: string) {
  return prisma.branch.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
  });
}

export async function createBranch(
  companyId: string,
  data: { name: string; address?: string }
) {
  const subscription = await getActiveSubscription(companyId);
  if (!subscription) {
    throw new BadRequestError('La empresa no tiene un plan activo');
  }

  const maxBranches = subscription.plan.maxBranches;
  if (maxBranches !== null) {
    const count = await prisma.branch.count({ where: { companyId } });
    if (count >= maxBranches) {
      throw new BadRequestError(`El plan activo permite máximo ${maxBranches} sede(s)`);
    }
  }

  return prisma.branch.create({
    data: {
      companyId,
      name: data.name,
      address: data.address,
    },
  });
}

export async function updateBranch(
  companyId: string,
  branchId: string,
  data: { name?: string; address?: string }
) {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, companyId },
  });

  if (!branch) {
    throw new NotFoundError('Sede no encontrada');
  }

  return prisma.branch.update({
    where: { id: branchId },
    data: {
      name: data.name,
      address: data.address,
    },
  });
}

const userSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  isActive: true,
  role: true,
  createdAt: true,
} as const;

export async function listSupervisors(companyId: string) {
  return prisma.user.findMany({
    where: { companyId, role: UserRole.supervisor },
    select: userSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export async function createSupervisor(
  companyId: string,
  data: { fullName: string; email: string; phone?: string }
) {
  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    throw new ConflictError('El email ya está registrado');
  }

  const user = await prisma.user.create({
    data: {
      companyId,
      role: UserRole.supervisor,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      passwordHash: null,
      isActive: true,
    },
    select: userSelect,
  });

  const invitationUrl = await createInvitationForUser(user.id);

  return { user, invitationUrl };
}

export async function updateSupervisorStatus(
  companyId: string,
  supervisorId: string,
  isActive: boolean
) {
  const supervisor = await prisma.user.findFirst({
    where: { id: supervisorId, companyId, role: UserRole.supervisor },
  });

  if (!supervisor) {
    throw new NotFoundError('Supervisor no encontrado');
  }

  await prisma.user.update({
    where: { id: supervisorId },
    data: { isActive },
  });

  if (!isActive) {
    await revokeAllUserRefreshTokens(supervisorId);
  }

  return { id: supervisorId, isActive };
}

export async function listDrivers(companyId: string) {
  const users = await prisma.user.findMany({
    where: { companyId, role: UserRole.driver },
    include: { driver: true },
    orderBy: { createdAt: 'desc' },
  });

  return users.map((user) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    status: user.driver?.status ?? DriverStatus.unavailable,
    createdAt: user.createdAt,
  }));
}

export async function createDriver(
  companyId: string,
  data: { fullName: string; email: string; phone?: string }
) {
  const subscription = await getActiveSubscription(companyId);
  if (!subscription) {
    throw new BadRequestError('La empresa no tiene un plan activo');
  }

  const maxDrivers = subscription.plan.maxDrivers;
  if (maxDrivers !== null) {
    const count = await prisma.user.count({
      where: { companyId, role: UserRole.driver },
    });
    if (count >= maxDrivers) {
      throw new BadRequestError(`El plan activo permite máximo ${maxDrivers} conductor(es)`);
    }
  }

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    throw new ConflictError('El email ya está registrado');
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        companyId,
        role: UserRole.driver,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        passwordHash: null,
        isActive: true,
      },
      select: userSelect,
    });

    await tx.driver.create({
      data: { userId: created.id, status: DriverStatus.unavailable },
    });

    return created;
  });

  const invitationUrl = await createInvitationForUser(user.id);

  return { user: { ...user, status: DriverStatus.unavailable }, invitationUrl };
}

export async function updateDriver(
  companyId: string,
  driverId: string,
  data: { fullName?: string; email?: string; phone?: string }
) {
  const driver = await prisma.user.findFirst({
    where: { id: driverId, companyId, role: UserRole.driver },
  });

  if (!driver) {
    throw new NotFoundError('Conductor no encontrado');
  }

  if (data.email && data.email !== driver.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new ConflictError('El email ya está registrado');
    }
  }

  return prisma.user.update({
    where: { id: driverId },
    data: {
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
    },
    select: userSelect,
  });
}

export async function updateDriverStatus(
  companyId: string,
  driverId: string,
  isActive: boolean
) {
  const driver = await prisma.user.findFirst({
    where: { id: driverId, companyId, role: UserRole.driver },
  });

  if (!driver) {
    throw new NotFoundError('Conductor no encontrado');
  }

  await prisma.user.update({
    where: { id: driverId },
    data: { isActive },
  });

  if (!isActive) {
    await revokeAllUserRefreshTokens(driverId);
  }

  return { id: driverId, isActive };
}

export async function updateDriverAvailability(
  companyId: string,
  driverId: string,
  status: DriverStatus
) {
  const driver = await prisma.driver.findFirst({
    where: { userId: driverId, user: { companyId, role: UserRole.driver } },
  });

  if (!driver) {
    throw new NotFoundError('Conductor no encontrado');
  }

  await prisma.driver.update({
    where: { userId: driverId },
    data: { status },
  });

  return { id: driverId, status };
}
