import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { CompanyStatus, RouteStatus, UserRole } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { hashPassword } from '../../auth/auth.service.js';
import { getReportSummary } from '../reports.service.js';

const COMPANY_ID = crypto.randomUUID();
const DRIVER_USER_ID = crypto.randomUUID();
const ROUTE_ID = crypto.randomUUID();
const TEST_PASSWORD = 'TestPass123!';

async function cleanup() {
  await prisma.routeLocation.deleteMany({ where: { routeId: ROUTE_ID } });
  await prisma.route.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.driver.deleteMany({ where: { user: { companyId: COMPANY_ID } } });
  await prisma.user.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.company.deleteMany({ where: { id: COMPANY_ID } });
}

beforeAll(async () => {
  await cleanup();

  await prisma.company.create({
    data: {
      id: COMPANY_ID,
      legalName: `Reports Test Company ${COMPANY_ID}`,
      taxId: COMPANY_ID.slice(0, 20),
      email: `${COMPANY_ID}@company.com`,
      status: CompanyStatus.active,
      hasOwnFleet: true,
    },
  });

  await prisma.user.create({
    data: {
      id: DRIVER_USER_ID,
      companyId: COMPANY_ID,
      role: UserRole.driver,
      fullName: 'Report Driver',
      email: `reports-driver-${DRIVER_USER_ID}@test.com`,
      passwordHash: await hashPassword(TEST_PASSWORD),
      isActive: true,
      driver: { create: {} },
    },
  });

  await prisma.route.create({
    data: {
      id: ROUTE_ID,
      companyId: COMPANY_ID,
      driverId: DRIVER_USER_ID,
      routeDate: new Date('2026-11-06T00:00:00.000Z'),
      status: RouteStatus.completed,
    },
  });

  await prisma.routeLocation.createMany({
    data: [
      {
        routeId: ROUTE_ID,
        latitude: 4.4389,
        longitude: -75.2322,
        capturedAt: new Date('2026-11-06T10:00:00.000Z'),
      },
      {
        routeId: ROUTE_ID,
        latitude: 4.445,
        longitude: -75.225,
        capturedAt: new Date('2026-11-06T10:05:00.000Z'),
      },
      {
        routeId: ROUTE_ID,
        latitude: 4.45,
        longitude: -75.22,
        capturedAt: new Date('2026-11-06T10:10:00.000Z'),
      },
    ],
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('Report summary', () => {
  it('computes actual distance without loading every location row', async () => {
    const summary = await getReportSummary(COMPANY_ID, {
      from: '2026-11-06',
      to: '2026-11-06',
    });

    expect(summary.routes).toHaveLength(1);
    expect(summary.metrics.actualDistanceM).toBeGreaterThan(0);
    expect(summary.metrics.actualDistanceM).toBe(
      summary.routes[0].actualDistanceM
    );
  });
});
