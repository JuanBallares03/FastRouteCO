import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import {
  CompanyStatus,
  DriverStatus,
  OrderPriority,
  OrderStatus,
  OrderType,
  RouteStatus,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import routeRoutes from '../routes.routes.js';
import orderRoutes from '../../orders/orders.routes.js';
import { prisma } from '../../../lib/prisma.js';
import { hashPassword, createTokenPair } from '../../auth/auth.service.js';
import {
  approximatePath,
  resetRoutingEngine,
  setRoutingEngine,
} from '../../../lib/routing.js';

const app = express();
app.use(express.json());
app.use('/api/v1/routes', routeRoutes);
app.use('/api/v1/orders', orderRoutes);

const COMPANY_ID = crypto.randomUUID();
const OTHER_COMPANY_ID = crypto.randomUUID();
const ADMIN_ID = crypto.randomUUID();
const DRIVER_A_ID = crypto.randomUUID();
const DRIVER_B_ID = crypto.randomUUID();
const UNAVAILABLE_DRIVER_ID = crypto.randomUUID();
const OTHER_ADMIN_ID = crypto.randomUUID();
const TEST_PASSWORD = 'TestPass123!';
const ROUTE_DATE = '2026-11-06';

let adminToken: string;
let otherAdminToken: string;

const companyIds = [COMPANY_ID, OTHER_COMPANY_ID];

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function cleanup() {
  await prisma.creditTransaction.deleteMany({
    where: { companyId: { in: companyIds } },
  });
  await prisma.creditBalance.deleteMany({
    where: { companyId: { in: companyIds } },
  });
  await prisma.subscription.deleteMany({
    where: { companyId: { in: companyIds } },
  });
  await prisma.routeStop.deleteMany({ where: { route: { companyId: { in: companyIds } } } });
  await prisma.route.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.order.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.driver.deleteMany({ where: { user: { companyId: { in: companyIds } } } });
  await prisma.refreshToken.deleteMany({ where: { user: { companyId: { in: companyIds } } } });
  await prisma.userInvitation.deleteMany({ where: { user: { companyId: { in: companyIds } } } });
  await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  await prisma.plan.deleteMany({ where: { name: { startsWith: 'Routes Plan ' } } });
}

let orderCounter = 0;
async function createOrder(companyId = COMPANY_ID, overrides: Record<string, unknown> = {}) {
  orderCounter++;
  return prisma.order.create({
    data: {
      companyId,
      type: OrderType.delivery,
      address: `Calle ${orderCounter} # 1-2, IbaguÃ©`,
      latitude: 4.4389,
      longitude: -75.2322,
      priority: OrderPriority.normal,
      status: OrderStatus.pending,
      ...overrides,
    },
  });
}

beforeAll(async () => {
  await cleanup();

  for (const companyId of companyIds) {
    await prisma.company.create({
      data: {
        id: companyId,
        legalName: `Routes Test Company ${companyId}`,
        taxId: companyId.slice(0, 20),
        email: `${companyId}@company.com`,
        status: CompanyStatus.active,
        hasOwnFleet: true,
      },
    });
  }

  const plan = await prisma.plan.create({
    data: {
      name: `Routes Plan ${COMPANY_ID}`,
      modality: 'subscription',
      trialDays: 0,
      monthlyCredits: 100,
      monthlyPrice: 100000,
      isActive: true,
    },
  });

  for (const companyId of companyIds) {
    await prisma.subscription.create({
      data: {
        companyId,
        planId: plan.id,
        status: SubscriptionStatus.active,
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        renewalDate: new Date('2027-11-01T00:00:00.000Z'),
      },
    });
    await prisma.creditBalance.create({
      data: { companyId, planCredits: 100, extraCredits: 0 },
    });
  }

  const passwordHash = await hashPassword(TEST_PASSWORD);

  const admin = await prisma.user.create({
    data: {
      id: ADMIN_ID,
      companyId: COMPANY_ID,
      role: UserRole.company_admin,
      fullName: 'Company Admin',
      email: `routes-admin-${ADMIN_ID}@test.com`,
      passwordHash,
      isActive: true,
    },
  });

  const otherAdmin = await prisma.user.create({
    data: {
      id: OTHER_ADMIN_ID,
      companyId: OTHER_COMPANY_ID,
      role: UserRole.company_admin,
      fullName: 'Other Admin',
      email: `routes-other-${OTHER_ADMIN_ID}@test.com`,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      id: DRIVER_A_ID,
      companyId: COMPANY_ID,
      role: UserRole.driver,
      fullName: 'Driver A',
      email: `routes-driver-a-${DRIVER_A_ID}@test.com`,
      passwordHash,
      isActive: true,
      driver: { create: { status: DriverStatus.available } },
    },
  });

  await prisma.user.create({
    data: {
      id: DRIVER_B_ID,
      companyId: COMPANY_ID,
      role: UserRole.driver,
      fullName: 'Driver B',
      email: `routes-driver-b-${DRIVER_B_ID}@test.com`,
      passwordHash,
      isActive: true,
      driver: { create: { status: DriverStatus.available } },
    },
  });

  await prisma.user.create({
    data: {
      id: UNAVAILABLE_DRIVER_ID,
      companyId: COMPANY_ID,
      role: UserRole.driver,
      fullName: 'Driver Unavailable',
      email: `routes-driver-c-${UNAVAILABLE_DRIVER_ID}@test.com`,
      passwordHash,
      isActive: true,
      driver: { create: { status: DriverStatus.unavailable } },
    },
  });

  adminToken = (await createTokenPair(admin)).accessToken;
  otherAdminToken = (await createTokenPair(otherAdmin)).accessToken;
});

afterAll(async () => {
  await cleanup();
});

beforeEach(async () => {
  await prisma.creditTransaction.deleteMany({
    where: { companyId: { in: companyIds } },
  });
  await prisma.creditBalance.updateMany({
    where: { companyId: { in: companyIds } },
    data: { planCredits: 100, extraCredits: 0 },
  });
  await prisma.routeStop.deleteMany({ where: { route: { companyId: { in: companyIds } } } });
  await prisma.route.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.order.deleteMany({ where: { companyId: { in: companyIds } } });
});

async function createTrackedRoute(driverId: string, lat: number, lon: number) {
  const route = await prisma.route.create({
    data: {
      companyId: COMPANY_ID,
      driverId,
      routeDate: new Date('2026-11-05T00:00:00.000Z'),
      status: RouteStatus.in_progress,
    },
  });
  await prisma.routeLocation.create({
    data: {
      routeId: route.id,
      latitude: lat,
      longitude: lon,
      capturedAt: new Date(),
    },
  });
  return route;
}

describe('Driver suggestions', () => {
  it('ranks available drivers by distance to the order', async () => {
    const order = await createOrder();
    await createTrackedRoute(DRIVER_A_ID, 4.441, -75.231);
    await createTrackedRoute(DRIVER_B_ID, 4.5, -75.3);

    const res = await request(app)
      .get(`/api/v1/orders/${order.id}/driver-suggestions`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].driverId).toBe(DRIVER_A_ID);
    expect(res.body[0].distanceMeters).toBeLessThan(res.body[1].distanceMeters);
  });

  it('excludes drivers that are not available', async () => {
    const order = await createOrder();

    const res = await request(app)
      .get(`/api/v1/orders/${order.id}/driver-suggestions`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.map((item: { driverId: string }) => item.driverId)).not.toContain(
      UNAVAILABLE_DRIVER_ID
    );
  });

  it('rejects suggestions for non-pending orders', async () => {
    const order = await createOrder(COMPANY_ID, { status: OrderStatus.assigned });

    const res = await request(app)
      .get(`/api/v1/orders/${order.id}/driver-suggestions`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(409);
  });

  it('does not expose orders from another company', async () => {
    const order = await createOrder(OTHER_COMPANY_ID);

    const res = await request(app)
      .get(`/api/v1/orders/${order.id}/driver-suggestions`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(404);
  });
});

describe('Order assignment', () => {
  it('assigns a pending order to an available driver', async () => {
    const order = await createOrder();

    const res = await request(app)
      .post(`/api/v1/orders/${order.id}/assign`)
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE });

    expect(res.status).toBe(200);
    expect(res.body.route.driverId).toBe(DRIVER_A_ID);
    expect(res.body.route.stops).toHaveLength(1);
    expect(res.body.route.stops[0].order.id).toBe(order.id);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated?.status).toBe(OrderStatus.assigned);
  });

  it('rejects assigning an already assigned order', async () => {
    const order = await createOrder(COMPANY_ID, { status: OrderStatus.assigned });

    const res = await request(app)
      .post(`/api/v1/orders/${order.id}/assign`)
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE });

    expect(res.status).toBe(409);
  });

  it('rejects unavailable drivers', async () => {
    const order = await createOrder();

    const res = await request(app)
      .post(`/api/v1/orders/${order.id}/assign`)
      .set(authHeader(adminToken))
      .send({ driverId: UNAVAILABLE_DRIVER_ID, routeDate: ROUTE_DATE });

    expect(res.status).toBe(409);
  });

  it('reuses the driver route for the same date', async () => {
    const first = await createOrder();
    const second = await createOrder();

    await request(app)
      .post(`/api/v1/orders/${first.id}/assign`)
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE });

    const res = await request(app)
      .post(`/api/v1/orders/${second.id}/assign`)
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE });

    expect(res.status).toBe(200);
    expect(res.body.route.stops).toHaveLength(2);
    expect(res.body.route.stops.map((stop: { sequence: number }) => stop.sequence)).toEqual([1, 2]);
  });
});

describe('Route creation', () => {
  it('creates a route grouping pending orders in the given order', async () => {
    const first = await createOrder();
    const second = await createOrder();
    const third = await createOrder();

    const res = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE, orderIds: [third.id, first.id, second.id] });

    expect(res.status).toBe(201);
    expect(res.body.stops).toHaveLength(3);
    expect(res.body.stops.map((stop: { order: { id: string } }) => stop.order.id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);
    expect(res.body.stops.map((stop: { sequence: number }) => stop.sequence)).toEqual([1, 2, 3]);
    expect(res.body.driver.user.fullName).toBe('Driver A');

    const orders = await prisma.order.findMany({ where: { id: { in: [first.id, second.id, third.id] } } });
    expect(orders.every((order) => order.status === OrderStatus.assigned)).toBe(true);
  });

  it('appends new orders to the existing route for the same driver and date', async () => {
    const first = await createOrder();
    const second = await createOrder();

    await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE, orderIds: [first.id] });

    const res = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE, orderIds: [second.id] });

    expect(res.status).toBe(201);
    expect(res.body.stops).toHaveLength(2);
    expect(res.body.stops[1].sequence).toBe(2);
  });

  it('rejects orders that are already assigned', async () => {
    const order = await createOrder(COMPANY_ID, { status: OrderStatus.assigned });

    const res = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE, orderIds: [order.id] });

    expect(res.status).toBe(409);
  });

  it('rejects orders from another company', async () => {
    const order = await createOrder(OTHER_COMPANY_ID);

    const res = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE, orderIds: [order.id] });

    expect(res.status).toBe(404);
  });

  it('rejects an unknown driver', async () => {
    const order = await createOrder();

    const res = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({ driverId: crypto.randomUUID(), routeDate: ROUTE_DATE, orderIds: [order.id] });

    expect(res.status).toBe(404);
  });

  it('rejects duplicate order ids', async () => {
    const order = await createOrder();

    const res = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE, orderIds: [order.id, order.id] });

    expect(res.status).toBe(400);
  });
});

describe('Route listing', () => {
  it('lists routes for a date and keeps company isolation', async () => {
    const order = await createOrder();
    await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE, orderIds: [order.id] });

    const list = await request(app)
      .get(`/api/v1/routes?date=${ROUTE_DATE}`)
      .set(authHeader(adminToken));

    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].stops[0].order.id).toBe(order.id);

    const other = await request(app)
      .get('/api/v1/routes')
      .set(authHeader(otherAdminToken));

    expect(other.status).toBe(200);
    expect(other.body.total).toBe(0);
  });

  it('returns a route with its stops', async () => {
    const order = await createOrder();
    const created = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE, orderIds: [order.id] });

    const res = await request(app)
      .get(`/api/v1/routes/${created.body.id}`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.stops[0].order.latitude).toBeCloseTo(4.4389);
  });

  it('does not expose routes from another company', async () => {
    const order = await createOrder();
    const created = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE, orderIds: [order.id] });

    const res = await request(app)
      .get(`/api/v1/routes/${created.body.id}`)
      .set(authHeader(otherAdminToken));

    expect(res.status).toBe(404);
  });
});

describe('Route optimization', () => {
  const fakeEngine = {
    shortestPath: async (
      from: { latitude: number; longitude: number },
      to: { latitude: number; longitude: number }
    ) => approximatePath(from, to),
    distanceMatrix: async (
      points: Array<{ latitude: number; longitude: number }>
    ) => {
      const distances = points.map((from) =>
        points.map((to) => Math.round(Math.abs(from.longitude - to.longitude) * 100000))
      );
      return {
        distances,
        durations: distances.map((row) => row.map((distance) => distance / 10)),
        approximate: false,
      };
    },
  };

  beforeEach(() => {
    setRoutingEngine(fakeEngine);
  });

  afterAll(() => {
    resetRoutingEngine();
  });

  it('orders stops from the driver start and persists the optimization', async () => {
    const far = await createOrder(COMPANY_ID, { longitude: -75.2312 });
    const near = await createOrder(COMPANY_ID, { longitude: -75.2322 });
    const farthest = await createOrder(COMPANY_ID, { longitude: -75.2302 });

    const created = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE, orderIds: [far.id, near.id, farthest.id] });

    await prisma.route.update({
      where: { id: created.body.id },
      data: { startLatitude: 4.4389, startLongitude: -75.2332 },
    });

    const res = await request(app)
      .post(`/api/v1/routes/${created.body.id}/optimize`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(RouteStatus.optimized);
    expect(
      res.body.stops.map((stop: { order: { id: string } }) => stop.order.id)
    ).toEqual([near.id, far.id, farthest.id]);
    expect(res.body.stops.map((stop: { sequence: number }) => stop.sequence)).toEqual([1, 2, 3]);
    expect(res.body.optimization.totalDistanceM).toBe(300);
    expect(res.body.optimization.estimatedDurationS).toBe(30);
    expect(res.body.optimization.processingTimeMs).toBeGreaterThanOrEqual(0);
    expect(res.body.startLatitude).toBeCloseTo(4.4389);
    expect(res.body.startLongitude).toBeCloseTo(-75.2332);

    const stored = await prisma.routeOptimization.findFirst({
      where: { routeId: created.body.id },
    });
    expect(stored?.isSuccessful).toBe(true);
    expect(stored?.totalDistanceM).toBe(300);
  });

  it('rejects routes with stops without coordinates', async () => {
    const order = await createOrder(COMPANY_ID, { latitude: null, longitude: null });
    const created = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE, orderIds: [order.id] });

    const res = await request(app)
      .post(`/api/v1/routes/${created.body.id}/optimize`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ROUTE_STOPS_WITHOUT_COORDINATES');
  });

  it('does not optimize routes from another company', async () => {
    const order = await createOrder();
    const created = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE, orderIds: [order.id] });

    const res = await request(app)
      .post(`/api/v1/routes/${created.body.id}/optimize`)
      .set(authHeader(otherAdminToken));

    expect(res.status).toBe(404);
  });
});

