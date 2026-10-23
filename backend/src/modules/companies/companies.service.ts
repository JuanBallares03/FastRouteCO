import { Prisma, CompanyStatus, SubscriptionStatus, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { sendCompanyConfirmationEmail } from '../../lib/email.js';
import { createInvitationForUser } from '../auth/auth.service.js';

const FREE_TRIAL_DAYS = 7;

export async function createCompany(data: {
  legalName: string;
  taxId: string;
  email: string;
  phone?: string;
  address?: string;
  hasOwnFleet: boolean;
}) {
  if (!data.hasOwnFleet) {
    throw new Error('La empresa debe tener flota propia');
  }

  const existingCompany = await prisma.company.findUnique({
    where: { taxId: data.taxId },
  });

  if (existingCompany) {
    throw new Error('El NIT ya está registrado');
  }

  const freeTrialPlan = await prisma.plan.findFirst({
    where: {
      trialDays: { gte: FREE_TRIAL_DAYS },
      isActive: true,
    },
    orderBy: { trialDays: 'desc' },
  });

  if (!freeTrialPlan) {
    throw new Error('No hay plan de prueba gratuita disponible');
  }

  const now = new Date();
  const renewalDate = new Date(now);
  renewalDate.setDate(renewalDate.getDate() + FREE_TRIAL_DAYS);

  const company = await prisma.$transaction(async (tx) => {
    const newCompany = await tx.company.create({
      data: {
        legalName: data.legalName,
        taxId: data.taxId,
        email: data.email,
        phone: data.phone,
        address: data.address,
        hasOwnFleet: data.hasOwnFleet,
        status: CompanyStatus.active,
      },
    });

    await tx.subscription.create({
      data: {
        companyId: newCompany.id,
        planId: freeTrialPlan.id,
        status: SubscriptionStatus.active,
        billingCycle: null,
        paymentId: null,
        startDate: now,
        renewalDate,
        endDate: null,
      },
    });

    await tx.creditBalance.create({
      data: {
        companyId: newCompany.id,
        planCredits: freeTrialPlan.monthlyCredits ?? 0,
        extraCredits: 0,
      },
    });

    return newCompany;
  });

  await sendCompanyConfirmationEmail(company.email, company.legalName);

  return company;
}

export async function listCompanies(filters: {
  companyStatus?: CompanyStatus;
  subscriptionStatus?: SubscriptionStatus;
  planId?: string;
  search?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.CompanyWhereInput = {};

  if (filters.companyStatus) {
    where.status = filters.companyStatus;
  }

  if (filters.subscriptionStatus || filters.planId) {
    where.subscriptions = {
      some: {
        ...(filters.subscriptionStatus && { status: filters.subscriptionStatus }),
        ...(filters.planId && { planId: filters.planId }),
      },
    };
  }

  if (filters.search) {
    where.OR = [
      { legalName: { contains: filters.search, mode: 'insensitive' } },
      { taxId: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: {
        subscriptions: {
          where: { status: SubscriptionStatus.active },
          include: { plan: true },
          take: 1,
        },
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.company.count({ where }),
  ]);

  return {
    data: companies.map((c) => ({
      ...c,
      activeSubscription: c.subscriptions[0] ?? null,
      adminsCount: c._count.users,
    })),
    meta: {
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil(total / filters.pageSize),
    },
  };
}

export async function getCompanyById(id: string) {
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      subscriptions: {
        where: { status: SubscriptionStatus.active },
        include: { plan: true },
        take: 1,
      },
      users: {
        where: { role: UserRole.company_admin },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
        },
      },
    },
  });

  if (!company) return null;

  return {
    ...company,
    activeSubscription: company.subscriptions[0] ?? null,
    admins: company.users,
  };
}

export async function updateCompanyStatus(id: string, isActive: boolean) {
  const company = await prisma.company.findUnique({
    where: { id },
    include: { users: true },
  });

  if (!company) {
    throw new Error('Empresa no encontrada');
  }

  const newStatus = isActive ? CompanyStatus.active : CompanyStatus.inactive;

  await prisma.$transaction(async (tx) => {
    await tx.company.update({
      where: { id },
      data: { status: newStatus },
    });

    if (!isActive) {
      const userIds = company.users.map((u) => u.id);
      if (userIds.length > 0) {
        await tx.refreshToken.updateMany({
          where: { userId: { in: userIds }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
  });

  return { id, status: newStatus };
}

export async function listCompanyAdmins(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    throw new Error('Empresa no encontrada');
  }

  const admins = await prisma.user.findMany({
    where: { companyId, role: UserRole.company_admin },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return admins;
}

export async function createCompanyAdmin(
  companyId: string,
  data: { fullName: string; email: string; phone?: string }
) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    throw new Error('Empresa no encontrada');
  }

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    throw new Error('El email ya está registrado');
  }

  const user = await prisma.user.create({
    data: {
      companyId,
      role: UserRole.company_admin,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      passwordHash: null,
      isActive: true,
    },
  });

  const invitationUrl = await createInvitationForUser(user.id);

  return { user, invitationUrl };
}

export async function updateCompanyAdminStatus(
  companyId: string,
  adminId: string,
  isActive: boolean
) {
  const admin = await prisma.user.findFirst({
    where: { id: adminId, companyId, role: UserRole.company_admin },
  });

  if (!admin) {
    throw new Error('Administrador no encontrado');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: adminId },
      data: { isActive },
    });

    if (!isActive) {
      await tx.refreshToken.updateMany({
        where: { userId: adminId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  });

  return { id: adminId, isActive };
}