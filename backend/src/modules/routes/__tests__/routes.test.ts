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
  StopStatus,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import routeRoutes from '../routes.routes.js';
import orderRoutes from '../../orders/orders.routes.js';
import incidentRoutes from '../../incidents/incidents.routes.js';
import { prisma } from '../../../lib/prisma.js';
import { hashPassword, createTokenPair } from '../../auth/auth.service.js';
import {
  approximatePath,
  resetRoutingEngine,
  setRoutingEngine,
} from '../../../lib/routing.js';
import { todayInBogota } from '../../../lib/dates.js';

const app = express();
app.use(express.json());
app.use('/api/v1/routes', routeRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/incidents', incidentRoutes);

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
let driverAToken: string;
let driverBToken: string;

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
  await prisma.incidentMessage.deleteMany({
    where: { incident: { route: { companyId: { in: companyIds } } } },
  });
  await prisma.incident.deleteMany({
    where: { route: { companyId: { in: companyIds } } },
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

  const driverA = await prisma.user.create({
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

  const driverB = await prisma.user.create({
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
  driverAToken = (await createTokenPair(driverA)).accessToken;
  driverBToken = (await createTokenPair(driverB)).accessToken;
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
  await prisma.incidentMessage.deleteMany({
    where: { incident: { route: { companyId: { in: companyIds } } } },
  });
  await prisma.incident.deleteMany({
    where: { route: { companyId: { in: companyIds } } },
  });
  await prisma.routeStop.deleteMany({ where: { route: { companyId: { in: companyIds } } } });
  await prisma.route.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.order.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.driver.updateMany({
    where: { userId: { in: [DRIVER_A_ID, DRIVER_B_ID] } },
    data: { status: DriverStatus.available },
  });
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

  it('assigns a pending order only once under concurrent requests', async () => {
    const order = await createOrder();

    const responses = await Promise.all([
      request(app)
        .post(`/api/v1/orders/${order.id}/assign`)
        .set(authHeader(adminToken))
        .send({ driverId: DRIVER_A_ID, routeDate: ROUTE_DATE }),
      request(app)
        .post(`/api/v1/orders/${order.id}/assign`)
        .set(authHeader(adminToken))
        .send({ driverId: DRIVER_B_ID, routeDate: ROUTE_DATE }),
    ]);

    const statuses = responses.map((res) => res.status).sort();
    expect(statuses).toEqual([200, 409]);
    expect(
      await prisma.routeStop.count({ where: { orderId: order.id } })
    ).toBe(1);
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

describe('Driver route execution', () => {
  async function createDriverRoute(
    driverId = DRIVER_A_ID,
    orderIds?: string[],
    routeDate = todayInBogota()
  ) {
    const ids = orderIds ?? [(await createOrder()).id];
    const created = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({ driverId, routeDate, orderIds: ids });

    expect(created.status).toBe(201);
    return created.body as {
      id: string;
      stops: Array<{ id: string; order: { id: string } }>;
    };
  }

  it('returns the route assigned to the authenticated driver for today', async () => {
    const route = await createDriverRoute();

    const res = await request(app)
      .get('/api/v1/routes/driver/today')
      .set(authHeader(driverAToken));

    expect(res.status).toBe(200);
    expect(res.body.route.id).toBe(route.id);

    const other = await request(app)
      .get('/api/v1/routes/driver/today')
      .set(authHeader(driverBToken));

    expect(other.status).toBe(200);
    expect(other.body.route).toBeNull();
  });

  it('does not expose another driver route', async () => {
    const route = await createDriverRoute();

    const res = await request(app)
      .get(`/api/v1/routes/driver/${route.id}`)
      .set(authHeader(driverBToken));

    expect(res.status).toBe(404);
  });

  it('starts the route once and marks the driver as on route', async () => {
    const route = await createDriverRoute();

    const res = await request(app)
      .post(`/api/v1/routes/driver/${route.id}/start`)
      .set(authHeader(driverAToken))
      .send({ latitude: 4.4389, longitude: -75.2322 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(RouteStatus.in_progress);
    expect(res.body.startedAt).not.toBeNull();
    expect(res.body.startLatitude).toBeCloseTo(4.4389);
    expect(res.body.startLongitude).toBeCloseTo(-75.2322);

    const driver = await prisma.driver.findUnique({ where: { userId: DRIVER_A_ID } });
    expect(driver?.status).toBe(DriverStatus.on_route);

    const repeated = await request(app)
      .post(`/api/v1/routes/driver/${route.id}/start`)
      .set(authHeader(driverAToken))
      .send({});

    expect(repeated.status).toBe(200);
    expect(repeated.body.status).toBe(RouteStatus.in_progress);
  });

  it('rejects route start for administrators', async () => {
    const route = await createDriverRoute();

    const res = await request(app)
      .post(`/api/v1/routes/driver/${route.id}/start`)
      .set(authHeader(adminToken))
      .send({});

    expect(res.status).toBe(403);
  });

  it('verifies geofence arrivals and allows manual marking', async () => {
    const near = await createOrder(COMPANY_ID, { latitude: 4.4389, longitude: -75.2322 });
    const far = await createOrder(COMPANY_ID, { latitude: 4.5, longitude: -75.3 });
    const route = await createDriverRoute(DRIVER_A_ID, [near.id, far.id]);

    await request(app)
      .post(`/api/v1/routes/driver/${route.id}/start`)
      .set(authHeader(driverAToken))
      .send({ latitude: 4.4389, longitude: -75.2322 });

    const verified = await request(app)
      .post(`/api/v1/routes/driver/${route.id}/stops/${route.stops[0].id}/arrive`)
      .set(authHeader(driverAToken))
      .send({ latitude: 4.4389, longitude: -75.2321, method: 'geofence' });

    expect(verified.status).toBe(200);
    expect(verified.body.stops[0].status).toBe(StopStatus.arrived);
    expect(verified.body.stops[0].isGeofenceVerified).toBe(true);

    const outside = await request(app)
      .post(`/api/v1/routes/driver/${route.id}/stops/${route.stops[1].id}/arrive`)
      .set(authHeader(driverAToken))
      .send({ latitude: 4.4389, longitude: -75.2321, method: 'geofence' });

    expect(outside.status).toBe(409);
    expect(outside.body.code).toBe('OUTSIDE_GEOFENCE');

    const manual = await request(app)
      .post(`/api/v1/routes/driver/${route.id}/stops/${route.stops[1].id}/arrive`)
      .set(authHeader(driverAToken))
      .send({ method: 'manual' });

    expect(manual.status).toBe(200);
    expect(manual.body.stops[1].status).toBe(StopStatus.arrived);
    expect(manual.body.stops[1].isGeofenceVerified).toBe(false);
  });

  it('completes a stop only with photo evidence', async () => {
    const route = await createDriverRoute();
    await request(app)
      .post(`/api/v1/routes/driver/${route.id}/start`)
      .set(authHeader(driverAToken))
      .send({});

    const missing = await request(app)
      .post(`/api/v1/routes/driver/${route.id}/stops/${route.stops[0].id}/complete`)
      .set(authHeader(driverAToken))
      .send({ evidence: [] });

    expect(missing.status).toBe(400);

    const res = await request(app)
      .post(`/api/v1/routes/driver/${route.id}/stops/${route.stops[0].id}/complete`)
      .set(authHeader(driverAToken))
      .send({
        evidence: [
          {
            photoUrl: 'https://res.cloudinary.com/demo/image/upload/evidence.jpg',
            capturedAt: '2026-11-06T12:00:00.000Z',
          },
        ],
        notes: 'Entregado en portería',
        recipientName: 'Recepción',
      });

    expect(res.status).toBe(200);
    expect(res.body.stops[0].status).toBe(StopStatus.completed);
    expect(res.body.stops[0].evidencePhotos).toHaveLength(1);
    expect(res.body.stops[0].evidencePhotos[0].photoUrl).toContain('evidence.jpg');
    expect(res.body.stops[0].recipientName).toBe('Recepción');

    const order = await prisma.order.findUnique({ where: { id: route.stops[0].order.id } });
    expect(order?.status).toBe(OrderStatus.completed);

    const repeated = await request(app)
      .post(`/api/v1/routes/driver/${route.id}/stops/${route.stops[0].id}/complete`)
      .set(authHeader(driverAToken))
      .send({
        evidence: [{ photoUrl: 'https://res.cloudinary.com/demo/image/upload/another.jpg' }],
      });

    expect(repeated.status).toBe(200);
    const evidenceCount = await prisma.evidencePhoto.count({
      where: { stopId: route.stops[0].id },
    });
    expect(evidenceCount).toBe(1);
  });

  it('finishes the route after all stops are completed', async () => {
    const route = await createDriverRoute();
    await request(app)
      .post(`/api/v1/routes/driver/${route.id}/start`)
      .set(authHeader(driverAToken))
      .send({});

    const pending = await request(app)
      .post(`/api/v1/routes/driver/${route.id}/finish`)
      .set(authHeader(driverAToken));

    expect(pending.status).toBe(409);
    expect(pending.body.code).toBe('ROUTE_HAS_PENDING_STOPS');

    await request(app)
      .post(`/api/v1/routes/driver/${route.id}/stops/${route.stops[0].id}/complete`)
      .set(authHeader(driverAToken))
      .send({
        evidence: [{ photoUrl: 'https://res.cloudinary.com/demo/image/upload/evidence.jpg' }],
      });

    const res = await request(app)
      .post(`/api/v1/routes/driver/${route.id}/finish`)
      .set(authHeader(driverAToken));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(RouteStatus.completed);
    expect(res.body.endedAt).not.toBeNull();

    const driver = await prisma.driver.findUnique({ where: { userId: DRIVER_A_ID } });
    expect(driver?.status).toBe(DriverStatus.available);
  });

  it('stores offline GPS batches without duplicating captured points', async () => {
    const route = await createDriverRoute();
    await request(app)
      .post(`/api/v1/routes/driver/${route.id}/start`)
      .set(authHeader(driverAToken))
      .send({});

    const payload = {
      locations: [
        {
          latitude: 4.4389,
          longitude: -75.2322,
          capturedAt: '2026-11-06T12:00:00.000Z',
          isOffline: true,
        },
        {
          latitude: 4.4391,
          longitude: -75.2324,
          capturedAt: '2026-11-06T12:00:05.000Z',
          isOffline: true,
        },
      ],
    };

    const first = await request(app)
      .post(`/api/v1/routes/driver/${route.id}/locations`)
      .set(authHeader(driverAToken))
      .send(payload);

    expect(first.status).toBe(200);
    expect(first.body.inserted).toBe(2);

    const repeated = await request(app)
      .post(`/api/v1/routes/driver/${route.id}/locations`)
      .set(authHeader(driverAToken))
      .send(payload);

    expect(repeated.status).toBe(200);
    expect(repeated.body.inserted).toBe(0);

    const count = await prisma.routeLocation.count({ where: { routeId: route.id } });
    expect(count).toBe(2);

    const latest = await request(app)
      .get(`/api/v1/routes/${route.id}/locations/latest`)
      .set(authHeader(adminToken));

    expect(latest.status).toBe(200);
    expect(latest.body.latitude).toBeCloseTo(4.4391);
    expect(latest.body.longitude).toBeCloseTo(-75.2324);
  });

  it('returns a signed Cloudinary upload payload for evidence', async () => {
    const route = await createDriverRoute();
    await request(app)
      .post(`/api/v1/routes/driver/${route.id}/start`)
      .set(authHeader(driverAToken))
      .send({});

    const res = await request(app)
      .post(`/api/v1/routes/driver/${route.id}/stops/${route.stops[0].id}/evidence-signature`)
      .set(authHeader(driverAToken));

    expect(res.status).toBe(200);
    expect(typeof res.body.timestamp).toBe('number');
    expect(typeof res.body.signature).toBe('string');
    expect(res.body.folder).toContain(route.id);
    expect(res.body.folder).toContain(route.stops[0].id);
  });
});

describe('Route reassignment', () => {
  async function createDriverRoute(driverId: string, orderIds: string[]) {
    const created = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({ driverId, routeDate: todayInBogota(), orderIds });

    expect(created.status).toBe(201);
    return created.body as {
      id: string;
      driverId: string;
      stops: Array<{ id: string }>;
    };
  }

  it('reassigns a route to another available driver', async () => {
    const order = await createOrder();
    const route = await createDriverRoute(DRIVER_A_ID, [order.id]);

    const res = await request(app)
      .patch(`/api/v1/routes/${route.id}/driver`)
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_B_ID });

    expect(res.status).toBe(200);
    expect(res.body.driverId).toBe(DRIVER_B_ID);

    const previous = await prisma.driver.findUnique({ where: { userId: DRIVER_A_ID } });
    expect(previous?.status).toBe(DriverStatus.available);
  });

  it('rejects reassignment to an unavailable driver', async () => {
    const order = await createOrder();
    const route = await createDriverRoute(DRIVER_A_ID, [order.id]);

    const res = await request(app)
      .patch(`/api/v1/routes/${route.id}/driver`)
      .set(authHeader(adminToken))
      .send({ driverId: UNAVAILABLE_DRIVER_ID });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DRIVER_NOT_AVAILABLE');
  });

  it('moves a single stop to the target driver route', async () => {
    const orderA = await createOrder();
    const orderB = await createOrder();
    const orderC = await createOrder();
    const routeA = await createDriverRoute(DRIVER_A_ID, [orderA.id, orderB.id]);
    const routeB = await createDriverRoute(DRIVER_B_ID, [orderC.id]);

    const res = await request(app)
      .post(`/api/v1/routes/${routeA.id}/stops/${routeA.stops[0].id}/reassign`)
      .set(authHeader(adminToken))
      .send({ driverId: DRIVER_B_ID });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(routeB.id);
    expect(res.body.stops).toHaveLength(2);
    expect(res.body.stops.some((stop: { id: string }) => stop.id === routeA.stops[0].id)).toBe(
      true
    );

    const remaining = await prisma.routeStop.count({ where: { routeId: routeA.id } });
    expect(remaining).toBe(1);
  });
});

describe('Incidents', () => {
  async function startedDriverRoute(driverId: string, token: string) {
    const order = await createOrder();
    const created = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(adminToken))
      .send({ driverId, routeDate: todayInBogota(), orderIds: [order.id] });

    expect(created.status).toBe(201);

    const started = await request(app)
      .post(`/api/v1/routes/driver/${created.body.id}/start`)
      .set(authHeader(token))
      .send({});

    expect(started.status).toBe(200);
    return started.body as { id: string; stops: Array<{ id: string }> };
  }

  it('lets a driver report an incident and chat with the office', async () => {
    const route = await startedDriverRoute(DRIVER_A_ID, driverAToken);

    const created = await request(app)
      .post('/api/v1/incidents')
      .set(authHeader(driverAToken))
      .send({
        routeId: route.id,
        stopId: route.stops[0].id,
        category: 'question',
        description: '¿Dónde debo dejar el paquete?',
      });

    expect(created.status).toBe(201);
    expect(created.body.status).toBe('open');
    expect(created.body.category).toBe('question');
    expect(created.body.route.id).toBe(route.id);

    const list = await request(app)
      .get(`/api/v1/incidents?routeId=${route.id}`)
      .set(authHeader(adminToken));

    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const reply = await request(app)
      .post(`/api/v1/incidents/${created.body.id}/messages`)
      .set(authHeader(adminToken))
      .send({ message: 'Déjalo en portería.' });

    expect(reply.status).toBe(201);
    expect(reply.body.incident.status).toBe('in_progress');
    expect(reply.body.message.senderId).toBe(ADMIN_ID);

    const resolved = await request(app)
      .patch(`/api/v1/incidents/${created.body.id}`)
      .set(authHeader(adminToken))
      .send({ status: 'resolved', resolutionNotes: 'Atendido por el administrador.' });

    expect(resolved.status).toBe(200);
    expect(resolved.body.status).toBe('resolved');
    expect(resolved.body.resolvedAt).not.toBeNull();

    const driverView = await request(app)
      .get(`/api/v1/incidents/${created.body.id}`)
      .set(authHeader(driverAToken));

    expect(driverView.status).toBe(200);
  });

  it('does not expose an incident to another driver', async () => {
    const route = await startedDriverRoute(DRIVER_A_ID, driverAToken);

    const created = await request(app)
      .post('/api/v1/incidents')
      .set(authHeader(driverAToken))
      .send({
        routeId: route.id,
        category: 'incident',
        description: 'El vehículo presenta una falla.',
      });

    expect(created.status).toBe(201);

    const res = await request(app)
      .get(`/api/v1/incidents/${created.body.id}`)
      .set(authHeader(driverBToken));

    expect(res.status).toBe(403);
  });
});

