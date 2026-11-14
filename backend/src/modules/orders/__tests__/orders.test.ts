import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import {
  CompanyStatus,
  DriverStatus,
  OrderStatus,
  RouteStatus,
  UserRole,
} from '@prisma/client';
import orderRoutes from '../orders.routes.js';
import { prisma } from '../../../lib/prisma.js';
import { hashPassword, createTokenPair } from '../../auth/auth.service.js';
import {
  GeocodingUnavailableError,
  resetGeocoder,
  setGeocoder,
  type Geocoder,
} from '../../../lib/geocoding.js';

const app = express();
app.use(express.json());
app.use('/api/v1/orders', orderRoutes);

const COMPANY_ID = crypto.randomUUID();
const OTHER_COMPANY_ID = crypto.randomUUID();
const ADMIN_ID = crypto.randomUUID();
const SUPERVISOR_ID = crypto.randomUUID();
const DRIVER_ID = crypto.randomUUID();
const OTHER_ADMIN_ID = crypto.randomUUID();
const BRANCH_ID = crypto.randomUUID();
const OTHER_BRANCH_ID = crypto.randomUUID();
const TEST_PASSWORD = 'TestPass123!';

let adminToken: string;
let supervisorToken: string;
let driverToken: string;
let otherAdminToken: string;

const companyIds = [COMPANY_ID, OTHER_COMPANY_ID];

const fakeGeocoder: Geocoder = {
  async geocode(address: string) {
    if (address.includes('INVALIDA')) return null;
    if (address.includes('SIN SERVICIO')) {
      throw new GeocodingUnavailableError();
    }
    return {
      latitude: 4.4389,
      longitude: -75.2322,
      displayName: address,
    };
  },
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function cleanup() {
  await prisma.routeStop.deleteMany({ where: { route: { companyId: { in: companyIds } } } });
  await prisma.route.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.order.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.branch.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.driver.deleteMany({ where: { user: { companyId: { in: companyIds } } } });
  await prisma.userInvitation.deleteMany({ where: { user: { companyId: { in: companyIds } } } });
  await prisma.refreshToken.deleteMany({ where: { user: { companyId: { in: companyIds } } } });
  await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.creditBalance.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.subscription.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}

beforeAll(async () => {
  await cleanup();
  setGeocoder(fakeGeocoder);

  for (const companyId of companyIds) {
    await prisma.company.create({
      data: {
        id: companyId,
        legalName: `Orders Test Company ${companyId}`,
        taxId: companyId.slice(0, 20),
        email: `${companyId}@company.com`,
        status: CompanyStatus.active,
        hasOwnFleet: true,
      },
    });
  }

  await prisma.branch.create({
    data: { id: BRANCH_ID, companyId: COMPANY_ID, name: 'Sede principal', address: 'Calle 1' },
  });
  await prisma.branch.create({
    data: { id: OTHER_BRANCH_ID, companyId: OTHER_COMPANY_ID, name: 'Sede ajena' },
  });

  const passwordHash = await hashPassword(TEST_PASSWORD);

  const admin = await prisma.user.create({
    data: {
      id: ADMIN_ID,
      companyId: COMPANY_ID,
      role: UserRole.company_admin,
      fullName: 'Company Admin',
      email: `orders-admin-${ADMIN_ID}@test.com`,
      passwordHash,
      isActive: true,
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      id: SUPERVISOR_ID,
      companyId: COMPANY_ID,
      role: UserRole.supervisor,
      fullName: 'Supervisor',
      email: `orders-supervisor-${SUPERVISOR_ID}@test.com`,
      passwordHash,
      isActive: true,
    },
  });

  const driver = await prisma.user.create({
    data: {
      id: DRIVER_ID,
      companyId: COMPANY_ID,
      role: UserRole.driver,
      fullName: 'Driver',
      email: `orders-driver-${DRIVER_ID}@test.com`,
      passwordHash,
      isActive: true,
      driver: { create: { status: DriverStatus.available } },
    },
  });

  const otherAdmin = await prisma.user.create({
    data: {
      id: OTHER_ADMIN_ID,
      companyId: OTHER_COMPANY_ID,
      role: UserRole.company_admin,
      fullName: 'Other Admin',
      email: `orders-other-${OTHER_ADMIN_ID}@test.com`,
      passwordHash,
      isActive: true,
    },
  });

  adminToken = (await createTokenPair(admin)).accessToken;
  supervisorToken = (await createTokenPair(supervisor)).accessToken;
  driverToken = (await createTokenPair(driver)).accessToken;
  otherAdminToken = (await createTokenPair(otherAdmin)).accessToken;
});

afterAll(async () => {
  resetGeocoder();
  await cleanup();
});

beforeEach(async () => {
  await prisma.routeStop.deleteMany({ where: { route: { companyId: { in: companyIds } } } });
  await prisma.route.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.order.deleteMany({ where: { companyId: { in: companyIds } } });
});

const baseOrder = {
  type: 'delivery',
  address: 'Calle 10 # 5-20, Ibagué',
  customerName: 'Cliente Prueba',
  customerPhone: '3001234567',
  description: 'Entregar en portería',
  channel: 'whatsapp',
  priority: 'normal',
};

describe('Orders Module', () => {
  describe('POST /api/v1/orders', () => {
    it('creates an order with geocoded coordinates', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send({ ...baseOrder, branchId: BRANCH_ID });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(OrderStatus.pending);
      expect(res.body.geocoded).toBe(true);
      expect(res.body.latitude).toBeCloseTo(4.4389);
      expect(res.body.longitude).toBeCloseTo(-75.2322);
      expect(res.body.branch.name).toBe('Sede principal');
    });

    it('rejects an address that cannot be geocoded', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send({ ...baseOrder, address: 'CALLE INVALIDA 123' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ADDRESS_NOT_FOUND');
      expect(res.body.message).toContain('No encontramos esa dirección');
      expect(await prisma.order.count({ where: { companyId: COMPANY_ID } })).toBe(0);
    });

    it('keeps working without coordinates when the geocoder is unavailable', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send({ ...baseOrder, address: 'CALLE SIN SERVICIO 456' });

      expect(res.status).toBe(201);
      expect(res.body.latitude).toBeNull();
      expect(res.body.longitude).toBeNull();
      expect(res.body.geocoded).toBe(false);
      expect(res.body.warning).toBeTruthy();
    });

    it('rejects a branch from another company', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send({ ...baseOrder, branchId: OTHER_BRANCH_ID });

      expect(res.status).toBe(404);
    });

    it('forbids drivers from registering orders', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set(authHeader(driverToken))
        .send(baseOrder);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/orders', () => {
    it('lists only orders of the authenticated company', async () => {
      await prisma.order.create({
        data: {
          companyId: OTHER_COMPANY_ID,
          type: 'pickup',
          address: 'Otra dirección',
        },
      });

      await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send(baseOrder);

      const res = await request(app)
        .get('/api/v1/orders')
        .set(authHeader(supervisorToken));

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.items[0].address).toBe(baseOrder.address);
    });

    it('filters by status and priority', async () => {
      await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send({ ...baseOrder, priority: 'urgent' });
      await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send({ ...baseOrder, address: 'Carrera 5 # 10-30', priority: 'normal' });

      const res = await request(app)
        .get('/api/v1/orders?priority=urgent')
        .set(authHeader(supervisorToken));

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.items[0].priority).toBe('urgent');
    });
  });

  describe('GET /api/v1/orders/:id', () => {
    it('returns the order with its route stops', async () => {
      const created = await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send(baseOrder);

      const res = await request(app)
        .get(`/api/v1/orders/${created.body.id}`)
        .set(authHeader(supervisorToken));

      expect(res.status).toBe(200);
      expect(res.body.routeStops).toEqual([]);
    });

    it('does not expose orders from another company', async () => {
      const created = await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send(baseOrder);

      const res = await request(app)
        .get(`/api/v1/orders/${created.body.id}`)
        .set(authHeader(otherAdminToken));

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/orders/:id', () => {
    it('updates fields and re-geocodes a new address', async () => {
      const created = await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send(baseOrder);

      const res = await request(app)
        .patch(`/api/v1/orders/${created.body.id}`)
        .set(authHeader(supervisorToken))
        .send({
          address: 'Carrera 8 # 12-40, Ibagué',
          priority: 'urgent',
          description: 'Cambio de horario',
        });

      expect(res.status).toBe(200);
      expect(res.body.address).toBe('Carrera 8 # 12-40, Ibagué');
      expect(res.body.priority).toBe('urgent');
      expect(res.body.geocoded).toBe(true);
    });

    it('clears coordinates when the new address cannot be geocoded', async () => {
      const created = await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send(baseOrder);

      const res = await request(app)
        .patch(`/api/v1/orders/${created.body.id}`)
        .set(authHeader(supervisorToken))
        .send({ address: 'CALLE SIN SERVICIO 123' });

      expect(res.status).toBe(200);
      expect(res.body.geocoded).toBe(false);
      expect(res.body.warning).toBeTruthy();

      const stored = await prisma.order.findUniqueOrThrow({
        where: { id: created.body.id },
      });
      expect(stored.latitude).toBeNull();
      expect(stored.longitude).toBeNull();
    });

    it('rejects editing a completed order', async () => {
      const created = await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send(baseOrder);

      await prisma.order.update({
        where: { id: created.body.id },
        data: { status: OrderStatus.completed },
      });

      const res = await request(app)
        .patch(`/api/v1/orders/${created.body.id}`)
        .set(authHeader(supervisorToken))
        .send({ priority: 'urgent' });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/v1/orders/:id/cancel', () => {
    it('cancels a pending order', async () => {
      const created = await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send(baseOrder);

      const res = await request(app)
        .post(`/api/v1/orders/${created.body.id}/cancel`)
        .set(authHeader(supervisorToken));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(OrderStatus.cancelled);
    });

    it('removes the stop and renumbers the route', async () => {
      const first = await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send(baseOrder);
      const second = await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send({ ...baseOrder, address: 'Carrera 5 # 10-30' });

      const route = await prisma.route.create({
        data: {
          companyId: COMPANY_ID,
          driverId: DRIVER_ID,
          routeDate: new Date('2026-11-05T00:00:00.000Z'),
          status: RouteStatus.created,
        },
      });

      await prisma.routeStop.createMany({
        data: [
          { routeId: route.id, orderId: first.body.id, sequence: 1 },
          { routeId: route.id, orderId: second.body.id, sequence: 2 },
        ],
      });
      await prisma.order.updateMany({
        where: { id: { in: [first.body.id, second.body.id] } },
        data: { status: OrderStatus.assigned },
      });

      const res = await request(app)
        .post(`/api/v1/orders/${first.body.id}/cancel`)
        .set(authHeader(supervisorToken));

      expect(res.status).toBe(200);

      const stops = await prisma.routeStop.findMany({
        where: { routeId: route.id },
        orderBy: { sequence: 'asc' },
      });
      expect(stops).toHaveLength(1);
      expect(stops[0].orderId).toBe(second.body.id);
      expect(stops[0].sequence).toBe(1);
    });

    it('deletes the route when its last stop is cancelled', async () => {
      const created = await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send(baseOrder);

      const route = await prisma.route.create({
        data: {
          companyId: COMPANY_ID,
          driverId: DRIVER_ID,
          routeDate: new Date('2026-11-05T00:00:00.000Z'),
        },
      });
      await prisma.routeStop.create({
        data: { routeId: route.id, orderId: created.body.id, sequence: 1 },
      });

      const res = await request(app)
        .post(`/api/v1/orders/${created.body.id}/cancel`)
        .set(authHeader(adminToken));

      expect(res.status).toBe(200);
      expect(await prisma.route.findUnique({ where: { id: route.id } })).toBeNull();
    });

    it('rejects cancelling a completed order', async () => {
      const created = await request(app)
        .post('/api/v1/orders')
        .set(authHeader(supervisorToken))
        .send(baseOrder);

      await prisma.order.update({
        where: { id: created.body.id },
        data: { status: OrderStatus.completed },
      });

      const res = await request(app)
        .post(`/api/v1/orders/${created.body.id}/cancel`)
        .set(authHeader(supervisorToken));

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/v1/orders/:id (validation)', () => {
    it('rejects an invalid order id', async () => {
      const res = await request(app)
        .get('/api/v1/orders/not-a-uuid')
        .set(authHeader(supervisorToken));

      expect(res.status).toBe(400);
    });
  });
});
