import { UserRole } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

type NotificationClient = Prisma.TransactionClient | typeof prisma;

export async function createAdminNotifications(
  client: NotificationClient,
  companyId: string,
  type: string,
  message: string
): Promise<void> {
  const admins = await client.user.findMany({
    where: { companyId, role: UserRole.company_admin, isActive: true },
    select: { id: true },
  });
  if (admins.length === 0) return;

  await client.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      companyId,
      type,
      message,
    })),
  });
}
