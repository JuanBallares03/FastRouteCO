import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import {
  AlertSeverity,
  CompanyStatus,
  DriverStatus,
  ServiceModality,
  SubscriptionStatus,
  SupportStatus,
  UserRole,
} from '@prisma/client';
import settingsRoutes from '../../settings/settings.routes.js';
import supportRoutes from '../../support/support.routes.js';
import monitoringRoutes from '../../monitoring/monitoring.routes.js';
import reportRoutes from '../../reports/reports.routes.js';
import studentRoutes from '../../students/students.routes.js';
import routeRoutes from '../../routes/routes.routes.js';
import { prisma } from '../../../lib/prisma.js';
import { hashPassword, createTokenPair } from '../../auth/auth.service.js';
import { resetGeocoder, setGeocoder } from '../../../lib/geocoding.js';
import { invalidateSettingsCache } from '../../settings/settings.service.js';

const app = express();
app.use(express.json());
app.use('/api/v1/platform', settingsRoutes);
app.use('/api/v1/platform', monitoringRoutes);
app.use('/api/v1', supportRoutes);
app.use('/api/v1/company/reports', reportRoutes);
app.use('/api/v1/company', studentRoutes);
app.use('/api/v1/routes', routeRoutes);

const COMPANY_ID = crypto.randomUUID();
const PLAN_ID = crypto.randomUUID();
const ADMIN_ID = crypto.randomUUID();
const SUPERVISOR_ID = crypto.randomUUID();
const DRIVER_ID = crypto.randomUUID();
const PLATFORM_ADMIN_ID = crypto.randomUUID();
const MODULE_CODE = 'school_transport';
const TEST_PASSWORD = 'TestPass123!';

let adminToken: string;
let supervisorToken: string;
let platformToken: string;

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function cleanup() {
  await prisma.notification.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.supportRequest.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.systemAlert.deleteMany({ where: { source: 'phase6-test' } });
  await prisma.routeStop.deleteMany({ where: { route: { companyId: COMPANY_ID } } });
  await prisma.route.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.student.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.order.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.driver.deleteMany({ where: { user: { companyId: COMPANY_ID } } });
  await prisma.refreshToken.deleteMany({
    where: { user: { id: { in: [ADMIN_ID, SUPERVISOR_ID, DRIVER_ID, PLATFORM_ADMIN_ID] } } },
  });
  await prisma.userInvitation.deleteMany({
    where: { user: { id: { in: [ADMIN_ID, SUPERVISOR_ID, DRIVER_ID, PLATFORM_ADMIN_ID] } } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [ADMIN_ID, SUPERVISOR_ID, DRIVER_ID, PLATFORM_ADMIN_ID] } },
  });
  await prisma.planModule.deleteMany({ where: { planId: PLAN_ID } });
  await prisma.subscription.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.creditBalance.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.company.deleteMany({ where: { id: COMPANY_ID } });
  await prisma.plan.deleteMany({ where: { id: PLAN_ID } });
}

beforeAll(async () => {
  await cleanup();

  const module = await prisma.module.upsert({
    where: { code: MODULE_CODE },
    update: { isActive: true },
    create: { code: MODULE_CODE, name: 'Transporte Escolar', isActive: true },
  });

  await prisma.plan.create({
    data: {
      id: PLAN_ID,
      name: `Phase6 Plan ${PLAN_ID}`,
      modality: ServiceModality.subscription,
      trialDays: 7,
      monthlyCredits: 100,
      monthlyPrice: 100000,
      isActive: true,
      planModules: { create: { moduleId: module.id } },
    },
  });

  await prisma.company.create({
    data: {
      id: COMPANY_ID,
      legalName: `Phase6 Company ${COMPANY_ID}`,
      taxId: COMPANY_ID.slice(0, 20),
      email: `${COMPANY_ID}@company.com`,
      status: CompanyStatus.active,
      hasOwnFleet: true,
    },
  });

  await prisma.subscription.create({
    data: {
      companyId: COMPANY_ID,
      planId: PLAN_ID,
      status: SubscriptionStatus.active,
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      renewalDate: new Date('2027-11-01T00:00:00.000Z'),
    },
  });

  await prisma.creditBalance.create({
    data: { companyId: COMPANY_ID, planCredits: 100, extraCredits: 0 },
  });

  const passwordHash = await hashPassword(TEST_PASSWORD);

  const admin = await prisma.user.create({
    data: {
      id: ADMIN_ID,
      companyId: COMPANY_ID,
      role: UserRole.company_admin,
      fullName: 'Phase6 Admin',
      email: `phase6-admin-${ADMIN_ID}@test.com`,
      passwordHash,
      isActive: true,
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      id: SUPERVISOR_ID,
      companyId: COMPANY_ID,
      role: UserRole.supervisor,
      fullName: 'Phase6 Supervisor',
      email: `phase6-supervisor-${SUPERVISOR_ID}@test.com`,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      id: DRIVER_ID,
      companyId: COMPANY_ID,
      role: UserRole.driver,
      fullName: 'Phase6 Driver',
      email: `phase6-driver-${DRIVER_ID}@test.com`,
      passwordHash,
      isActive: true,
      driver: { create: { status: DriverStatus.available } },
    },
  });

  const platformAdmin = await prisma.user.create({
    data: {
      id: PLATFORM_ADMIN_ID,
      role: UserRole.platform_admin,
      fullName: 'Phase6 Platform Admin',
      email: `phase6-platform-${PLATFORM_ADMIN_ID}@test.com`,
      passwordHash,
      isActive: true,
    },
  });

  adminToken = (await createTokenPair(admin)).accessToken;
  supervisorToken = (await createTokenPair(supervisor)).accessToken;
  platformToken = (await createTokenPair(platformAdmin)).accessToken;

  setGeocoder({
    geocode: async (address: string) => ({
      latitude: 4.439,
      longitude: -75.232,
      displayName: address,
    }),
  });
});

afterAll(async () => {
  resetGeocoder();
  await cleanup();
  invalidateSettingsCache();
});

beforeEach(async () => {
  await prisma.supportRequest.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.notification.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.systemAlert.deleteMany({ where: { source: 'phase6-test' } });
});

describe('System settings', () => {
  it('lists bounded settings for the platform administrator', async () => {
    const response = await request(app)
      .get('/api/v1/platform/settings')
      .set(authHeader(platformToken));

    expect(response.status).toBe(200);
    const passwordSetting = response.body.find(
      (item: { key: string }) => item.key === 'password_min_length'
    );
    expect(passwordSetting.min).toBe(10);
  });

  it('updates settings and applies them without restart', async () => {
    const response = await request(app)
      .patch('/api/v1/platform/settings')
      .set(authHeader(platformToken))
      .send({ access_token_minutes: 20 });

    expect(response.status).toBe(200);
    const updated = response.body.find(
      (item: { key: string }) => item.key === 'access_token_minutes'
    );
    expect(updated.value).toBe(20);

    invalidateSettingsCache();
    await request(app)
      .patch('/api/v1/platform/settings')
      .set(authHeader(platformToken))
      .send({ access_token_minutes: 15 });
  });

  it('rejects values below the safety bound', async () => {
    const response = await request(app)
      .patch('/api/v1/platform/settings')
      .set(authHeader(platformToken))
      .send({ password_min_length: 6 });

    expect(response.status).toBe(400);
  });

  it('blocks company users from editing settings', async () => {
    const response = await request(app)
      .patch('/api/v1/platform/settings')
      .set(authHeader(adminToken))
      .send({ access_token_minutes: 20 });

    expect(response.status).toBe(403);
  });
});

describe('School transport students', () => {
  it('reports the module entitlement from the plan', async () => {
    const response = await request(app)
      .get('/api/v1/company/students/entitlement')
      .set(authHeader(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.enabled).toBe(true);
  });

  it('registers a student with geocoded coordinates', async () => {
    const response = await request(app)
      .post('/api/v1/company/students')
      .set(authHeader(supervisorToken))
      .send({ fullName: 'Ana Perez', pickupAddress: 'Calle 10 # 5-20, Ibague' });

    expect(response.status).toBe(201);
    expect(response.body.latitude).toBeCloseTo(4.439);
    expect(response.body.longitude).toBeCloseTo(-75.232);
  });

  it('deactivates a student without deleting the record', async () => {
    const student = await prisma.student.create({
      data: {
        companyId: COMPANY_ID,
        fullName: 'Luis Gomez',
        pickupAddress: 'Carrera 5 # 20-10, Ibague',
        latitude: 4.44,
        longitude: -75.23,
      },
    });

    const response = await request(app)
      .patch(`/api/v1/company/students/${student.id}/status`)
      .set(authHeader(adminToken))
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.isActive).toBe(false);
    const stored = await prisma.student.findUnique({ where: { id: student.id } });
    expect(stored).not.toBeNull();
  });

  it('creates a route with a student stop', async () => {
    const student = await prisma.student.create({
      data: {
        companyId: COMPANY_ID,
        fullName: 'Sofia Ruiz',
        pickupAddress: 'Calle 12 # 4-30, Ibague',
        latitude: 4.441,
        longitude: -75.231,
      },
    });

    const response = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({
        driverId: DRIVER_ID,
        routeDate: '2026-11-20',
        studentIds: [student.id],
      });

    expect(response.status).toBe(201);
    expect(response.body.stops).toHaveLength(1);
    expect(response.body.stops[0].student.id).toBe(student.id);
  });
});

describe('Support requests', () => {
  it('lets the company admin create a request and blocks supervisors', async () => {
    const forbidden = await request(app)
      .post('/api/v1/company/support')
      .set(authHeader(supervisorToken))
      .send({ subject: 'Problema de acceso', description: 'No puedo ingresar al panel.' });

    expect(forbidden.status).toBe(403);

    const response = await request(app)
      .post('/api/v1/company/support')
      .set(authHeader(adminToken))
      .send({ subject: 'Problema de acceso', description: 'No puedo ingresar al panel.' });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe(SupportStatus.open);
  });

  it('answers the request, notifies admins and closes it', async () => {
    const created = await prisma.supportRequest.create({
      data: {
        companyId: COMPANY_ID,
        subject: 'Error en reportes',
        description: 'El reporte mensual no carga.',
      },
    });

    const response = await request(app)
      .post(`/api/v1/platform/support/${created.id}/respond`)
      .set(authHeader(platformToken))
      .send({ response: 'El problema fue corregido, vuelve a intentarlo.' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe(SupportStatus.answered);

    const notifications = await prisma.notification.count({
      where: { companyId: COMPANY_ID, type: 'support_response' },
    });
    expect(notifications).toBeGreaterThan(0);

    const closed = await request(app)
      .post(`/api/v1/platform/support/${created.id}/close`)
      .set(authHeader(platformToken));

    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe(SupportStatus.closed);
  });
});

describe('Reports and monitoring', () => {
  beforeEach(async () => {
    await prisma.routeStop.deleteMany({ where: { route: { companyId: COMPANY_ID } } });
    await prisma.route.deleteMany({ where: { companyId: COMPANY_ID } });
  });

  it('returns the company dashboard and report summary', async () => {
    const route = await prisma.route.create({
      data: {
        companyId: COMPANY_ID,
        driverId: DRIVER_ID,
        routeDate: new Date('2026-11-20T00:00:00.000Z'),
      },
    });
    const student = await prisma.student.create({
      data: {
        companyId: COMPANY_ID,
        fullName: 'Report Student',
        pickupAddress: 'Calle 20 # 1-2, Ibague',
        latitude: 4.44,
        longitude: -75.23,
      },
    });
    await prisma.routeStop.create({
      data: { routeId: route.id, studentId: student.id, sequence: 1 },
    });

    const summary = await request(app)
      .get('/api/v1/company/reports/summary')
      .query({ from: '2026-11-01', to: '2026-11-30' })
      .set(authHeader(adminToken));

    expect(summary.status).toBe(200);
    expect(summary.body.metrics.routesTotal).toBe(1);
    expect(summary.body.metrics.stopsTotal).toBe(1);

    const routesReport = await request(app)
      .get('/api/v1/company/reports/routes')
      .query({ from: '2026-11-01', to: '2026-11-30' })
      .set(authHeader(supervisorToken));

    expect(routesReport.status).toBe(200);
    expect(routesReport.body.routes).toHaveLength(1);

    const dashboard = await request(app)
      .get('/api/v1/company/reports/dashboard')
      .set(authHeader(supervisorToken));

    expect(dashboard.status).toBe(200);
    expect(dashboard.body).toHaveProperty('month');
  });

  it('records, lists and resolves platform alerts', async () => {
    const alert = await prisma.systemAlert.create({
      data: {
        severity: AlertSeverity.critical,
        source: 'phase6-test',
        message: 'Fallo simulado de prueba',
      },
    });

    const overview = await request(app)
      .get('/api/v1/platform/monitoring')
      .set(authHeader(platformToken));

    expect(overview.status).toBe(200);
    expect(overview.body.alerts.unresolved).toBeGreaterThan(0);

    const listed = await request(app)
      .get('/api/v1/platform/alerts')
      .query({ resolved: 'false' })
      .set(authHeader(platformToken));

    expect(listed.status).toBe(200);
    expect(
      listed.body.items.some((item: { id: string }) => item.id === alert.id.toString())
    ).toBe(true);

    const resolved = await request(app)
      .post(`/api/v1/platform/alerts/${alert.id.toString()}/resolve`)
      .set(authHeader(platformToken));

    expect(resolved.status).toBe(200);
    expect(resolved.body.resolvedAt).not.toBeNull();
  });
});
