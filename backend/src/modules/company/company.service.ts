import { Prisma, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

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
    throw new Error('Empresa no encontrada');
  }

  if (data.email && data.email !== company.email) {
    const existing = await prisma.company.findFirst({
      where: { email: data.email },
    });
    if (existing) {
      throw new Error('El email ya está registrado');
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