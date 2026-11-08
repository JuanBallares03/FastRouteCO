import {
  DriverStatus,
  OrderStatus,
  Prisma,
  RouteStatus,
  StopStatus,
  UserRole,
} from '@prisma/client';
import { performance } from 'node:perf_hooks';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '../../lib/prisma.js';
import { parseBusinessDate, todayInBogota } from '../../lib/dates.js';
import { haversineMeters } from '../../lib/geo.js';
import {
  optimizeStopOrder,
  totalPathDistance,
  totalPathDuration,
} from '../../lib/optimization.js';
import { getRoutingEngine } from '../../lib/routing.js';
import { emitToCompany } from '../../lib/realtime.js';
import type { Coordinates } from '../../lib/geocoding.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { env } from '../../env.js';
import {
  applyOptimizationBilling,
  assertOptimizationAllowed,
  checkSpendingWarning,
  processClosingUsageCharges,
  processUsageCharge,
  syncCompanySubscription,
} from '../billing/billing.service.js';

const ACTIVE_ROUTE_STATUSES: RouteStatus[] = [
  RouteStatus.created,
  RouteStatus.optimized,
  RouteStatus.in_progress,
];

const GEOFENCE_RADIUS_M = 100;

const routePriority: Record<string, number> = {
  [RouteStatus.in_progress]: 0,
  [RouteStatus.optimized]: 1,
  [RouteStatus.created]: 2,
};

const routeInclude = {
  stops: {
    include: {
      order: true,
      student: true,
      evidencePhotos: { orderBy: { capturedAt: 'asc' as const } },
    },
    orderBy: { sequence: 'asc' as const },
  },
  driver: {
    include: {
      user: {
        select: { id: true, fullName: true, email: true, phone: true },
      },
    },
  },
  optimizations: {
    orderBy: { optimizationDate: 'desc' },
    take: 1,
  },
} satisfies Prisma.RouteInclude;

type RouteWithRelations = Prisma.RouteGetPayload<{ include: typeof routeInclude }>;

function serializeOrder(
  order: Prisma.OrderGetPayload<Record<string, never>> | null
) {
  if (!order) return null;
  return {
    ...order,
    latitude: order.latitude === null ? null : Number(order.latitude),
    longitude: order.longitude === null ? null : Number(order.longitude),
  };
}

function serializeRoute(route: RouteWithRelations) {
  return {
    ...route,
    startLatitude: route.startLatitude === null ? null : Number(route.startLatitude),
    startLongitude: route.startLongitude === null ? null : Number(route.startLongitude),
    stops: route.stops.map((stop) => ({
      ...stop,
      order: serializeOrder(stop.order),
    })),
  };
}

async function findDriver(companyId: string, driverId: string) {
  const driver = await prisma.user.findFirst({
    where: { id: driverId, companyId, role: UserRole.driver, isActive: true },
    include: { driver: true },
  });

  if (!driver || !driver.driver) {
    throw new NotFoundError('Conductor no encontrado', 'DRIVER_NOT_FOUND');
  }

  return driver;
}

export async function suggestDrivers(companyId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, companyId } });
  if (!order) {
    throw new NotFoundError('Pedido no encontrado', 'ORDER_NOT_FOUND');
  }
  if (order.status !== OrderStatus.pending) {
    throw new ConflictError('Solo se pueden asignar pedidos pendientes', 'ORDER_NOT_PENDING');
  }

  const drivers = await prisma.user.findMany({
    where: {
      companyId,
      role: UserRole.driver,
      isActive: true,
      driver: { status: DriverStatus.available },
    },
    include: { driver: true },
  });

  const orderLocation =
    order.latitude !== null && order.longitude !== null
      ? { latitude: Number(order.latitude), longitude: Number(order.longitude) }
      : null;

  const suggestions = await Promise.all(
    drivers.map(async (driver) => {
      const [lastLocation, pendingStops] = await Promise.all([
        prisma.routeLocation.findFirst({
          where: { route: { driverId: driver.id, companyId } },
          orderBy: { capturedAt: 'desc' },
          select: { latitude: true, longitude: true, capturedAt: true },
        }),
        prisma.routeStop.count({
          where: {
            status: StopStatus.pending,
            route: {
              driverId: driver.id,
              companyId,
              status: { in: ACTIVE_ROUTE_STATUSES },
            },
          },
        }),
      ]);

      const driverLocation = lastLocation
        ? {
            latitude: Number(lastLocation.latitude),
            longitude: Number(lastLocation.longitude),
          }
        : null;

      const distanceMeters =
        orderLocation && driverLocation
          ? haversineMeters(driverLocation, orderLocation)
          : null;

      return {
        driverId: driver.id,
        fullName: driver.fullName,
        phone: driver.phone,
        distanceMeters,
        pendingStops,
        lastLocation: driverLocation
          ? { ...driverLocation, capturedAt: lastLocation?.capturedAt ?? null }
          : null,
      };
    })
  );

  return suggestions.sort((a, b) => {
    const distanceA = a.distanceMeters ?? Number.POSITIVE_INFINITY;
    const distanceB = b.distanceMeters ?? Number.POSITIVE_INFINITY;
    if (distanceA !== distanceB) return distanceA - distanceB;
    if (a.pendingStops !== b.pendingStops) return a.pendingStops - b.pendingStops;
    return a.fullName.localeCompare(b.fullName);
  });
}

export async function assignOrder(
  companyId: string,
  orderId: string,
  data: { driverId: string; routeDate?: string }
) {
  const order = await prisma.order.findFirst({ where: { id: orderId, companyId } });
  if (!order) {
    throw new NotFoundError('Pedido no encontrado', 'ORDER_NOT_FOUND');
  }
  if (order.status !== OrderStatus.pending) {
    throw new ConflictError('Solo se pueden asignar pedidos pendientes', 'ORDER_NOT_PENDING');
  }

  const driver = await findDriver(companyId, data.driverId);
  if (driver.driver?.status !== DriverStatus.available) {
    throw new ConflictError('El conductor no está disponible', 'DRIVER_NOT_AVAILABLE');
  }

  let routeDate: Date;
  try {
    routeDate = parseBusinessDate(data.routeDate ?? todayInBogota());
  } catch {
    throw new BadRequestError('Fecha de ruta inválida', 'INVALID_ROUTE_DATE');
  }

  const route = await prisma.$transaction(async (tx) => {
    const existingStop = await tx.routeStop.findFirst({ where: { orderId } });
    if (existingStop) {
      throw new ConflictError('El pedido ya está en una ruta', 'ORDER_ALREADY_ASSIGNED');
    }

    let target = await tx.route.findFirst({
      where: {
        companyId,
        driverId: data.driverId,
        routeDate,
        status: { in: [RouteStatus.created, RouteStatus.optimized] },
      },
      orderBy: { id: 'asc' },
    });

    if (!target) {
      target = await tx.route.create({
        data: {
          companyId,
          driverId: data.driverId,
          routeDate,
          status: RouteStatus.created,
        },
      });
    }

    const aggregate = await tx.routeStop.aggregate({
      where: { routeId: target.id },
      _max: { sequence: true },
    });
    const nextSequence = (aggregate._max.sequence ?? 0) + 1;

    await tx.routeStop.create({
      data: { routeId: target.id, orderId, sequence: nextSequence },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.assigned },
    });

    return target;
  });

  const assigned = await getRouteById(companyId, route.id);
  return { orderId, driverId: data.driverId, route: assigned };
}

export async function createRoute(
  companyId: string,
  data: { driverId: string; routeDate: string; orderIds: string[] }
) {
  const driver = await findDriver(companyId, data.driverId);

  let routeDate: Date;
  try {
    routeDate = parseBusinessDate(data.routeDate);
  } catch {
    throw new BadRequestError('Fecha de ruta inválida', 'INVALID_ROUTE_DATE');
  }

  const uniqueOrderIds = [...new Set(data.orderIds)];
  const orders = await prisma.order.findMany({
    where: { id: { in: uniqueOrderIds }, companyId },
  });

  if (orders.length !== uniqueOrderIds.length) {
    throw new NotFoundError('Uno o más pedidos no pertenecen a la empresa', 'ORDER_NOT_FOUND');
  }

  const notPending = orders.filter((order) => order.status !== OrderStatus.pending);
  if (notPending.length > 0) {
    throw new ConflictError(
      'Solo se pueden agrupar pedidos pendientes en una ruta',
      'ORDER_NOT_PENDING'
    );
  }

  const existingStops = await prisma.routeStop.findMany({
    where: { orderId: { in: uniqueOrderIds } },
  });
  if (existingStops.length > 0) {
    throw new ConflictError('Uno o más pedidos ya están en una ruta', 'ORDER_ALREADY_ASSIGNED');
  }

  const route = await prisma.$transaction(async (tx) => {
    let target = await tx.route.findFirst({
      where: {
        companyId,
        driverId: data.driverId,
        routeDate,
        status: { in: [RouteStatus.created, RouteStatus.optimized] },
      },
      orderBy: { id: 'asc' },
    });

    if (!target) {
      target = await tx.route.create({
        data: {
          companyId,
          driverId: data.driverId,
          routeDate,
          status: RouteStatus.created,
        },
      });
    }

    const aggregate = await tx.routeStop.aggregate({
      where: { routeId: target.id },
      _max: { sequence: true },
    });
    const firstSequence = (aggregate._max.sequence ?? 0) + 1;

    await tx.routeStop.createMany({
      data: uniqueOrderIds.map((orderId, index) => ({
        routeId: target.id,
        orderId,
        sequence: firstSequence + index,
      })),
    });
    await tx.order.updateMany({
      where: { id: { in: uniqueOrderIds } },
      data: { status: OrderStatus.assigned },
    });

    return target;
  });

  return {
    ...(await getRouteById(companyId, route.id)),
    driverAvailable: driver.driver?.status === DriverStatus.available,
  };
}

export async function listRoutes(
  companyId: string,
  filters: { date?: string; driverId?: string; status?: RouteStatus; page: number; pageSize: number }
) {
  let routeDate: Date | undefined;
  if (filters.date) {
    try {
      routeDate = parseBusinessDate(filters.date);
    } catch {
      throw new BadRequestError('Fecha de ruta inválida', 'INVALID_ROUTE_DATE');
    }
  }

  const where: Prisma.RouteWhereInput = {
    companyId,
    routeDate,
    driverId: filters.driverId,
    status: filters.status,
  };

  const [items, total] = await prisma.$transaction([
    prisma.route.findMany({
      where,
      include: routeInclude,
      orderBy: [{ routeDate: 'desc' }, { id: 'asc' }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.route.count({ where }),
  ]);

  return {
    items: items.map(serializeRoute),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getRouteById(companyId: string, routeId: string) {
  const route = await prisma.route.findFirst({
    where: { id: routeId, companyId },
    include: routeInclude,
  });

  if (!route) {
    throw new NotFoundError('Ruta no encontrada', 'ROUTE_NOT_FOUND');
  }

  return serializeRoute(route);
}

export async function getLatestRouteLocation(companyId: string, routeId: string) {
  const route = await prisma.route.findFirst({
    where: { id: routeId, companyId },
    select: { id: true },
  });

  if (!route) {
    throw new NotFoundError('Ruta no encontrada', 'ROUTE_NOT_FOUND');
  }

  const location = await prisma.routeLocation.findFirst({
    where: { routeId: route.id },
    orderBy: { capturedAt: 'desc' },
    select: { latitude: true, longitude: true, capturedAt: true, isOffline: true },
  });

  if (!location) {
    return null;
  }

  return {
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    capturedAt: location.capturedAt,
    isOffline: location.isOffline,
  };
}

async function findDriverRoute(companyId: string, driverId: string, routeId: string) {
  const route = await prisma.route.findFirst({
    where: { id: routeId, companyId, driverId },
    include: routeInclude,
  });

  if (!route) {
    throw new NotFoundError('Ruta no encontrada', 'ROUTE_NOT_FOUND');
  }

  return route;
}

export async function getDriverTodayRoute(companyId: string, driverId: string) {
  const routeDate = parseBusinessDate(todayInBogota());
  const routes = await prisma.route.findMany({
    where: {
      companyId,
      driverId,
      routeDate,
      status: { in: ACTIVE_ROUTE_STATUSES },
    },
    include: routeInclude,
  });

  if (routes.length === 0) {
    return { route: null };
  }

  routes.sort((left, right) => {
    const priority = (routePriority[left.status] ?? 99) - (routePriority[right.status] ?? 99);
    if (priority !== 0) return priority;
    return left.id.localeCompare(right.id);
  });

  return { route: serializeRoute(routes[0]) };
}

export async function getDriverRoute(companyId: string, driverId: string, routeId: string) {
  return serializeRoute(await findDriverRoute(companyId, driverId, routeId));
}

function assertBothCoordinates(value: { latitude?: number; longitude?: number }) {
  if ((value.latitude === undefined) !== (value.longitude === undefined)) {
    throw new BadRequestError('Debes enviar latitud y longitud juntas', 'INVALID_COORDINATES');
  }
}

export async function startDriverRoute(
  companyId: string,
  driverId: string,
  routeId: string,
  data: { latitude?: number; longitude?: number }
) {
  const route = await findDriverRoute(companyId, driverId, routeId);
  assertBothCoordinates(data);

  if (route.status === RouteStatus.in_progress) {
    return serializeRoute(route);
  }

  if (route.status !== RouteStatus.created && route.status !== RouteStatus.optimized) {
    throw new ConflictError('La ruta ya no se puede iniciar', 'ROUTE_NOT_STARTABLE');
  }

  const activeRoute = await prisma.route.findFirst({
    where: {
      companyId,
      driverId,
      status: RouteStatus.in_progress,
      id: { not: route.id },
    },
    select: { id: true },
  });

  if (activeRoute) {
    throw new ConflictError('Ya tienes otra ruta en curso', 'DRIVER_HAS_ACTIVE_ROUTE');
  }

  const subscription = await syncCompanySubscription(companyId);
  if (!subscription) {
    throw new ForbiddenError(
      'La suscripción o el periodo de prueba no está activo.',
      'SUBSCRIPTION_INACTIVE'
    );
  }

  await prisma.$transaction([
    prisma.route.update({
      where: { id: route.id },
      data: {
        status: RouteStatus.in_progress,
        startedAt: route.startedAt ?? new Date(),
        startLatitude: data.latitude ?? route.startLatitude,
        startLongitude: data.longitude ?? route.startLongitude,
      },
    }),
    prisma.driver.update({
      where: { userId: driverId },
      data: { status: DriverStatus.on_route },
    }),
  ]);

  const updated = await getDriverRoute(companyId, driverId, route.id);
  emitToCompany(companyId, 'route:status', {
    routeId: route.id,
    driverId,
    status: updated.status,
    route: updated,
  });
  emitToCompany(companyId, 'route:location', {
    routeId: route.id,
    driverId,
    locations:
      data.latitude !== undefined && data.longitude !== undefined
        ? [
            {
              latitude: data.latitude,
              longitude: data.longitude,
              capturedAt: new Date().toISOString(),
              isOffline: false,
            },
          ]
        : [],
  });
  return updated;
}

export async function finishDriverRoute(companyId: string, driverId: string, routeId: string) {
  const route = await findDriverRoute(companyId, driverId, routeId);

  if (route.status === RouteStatus.completed) {
    return serializeRoute(route);
  }

  if (route.status !== RouteStatus.in_progress) {
    throw new ConflictError('La ruta no está en curso', 'ROUTE_NOT_IN_PROGRESS');
  }

  const pendingStops = route.stops.filter((stop) => stop.status !== StopStatus.completed);
  if (pendingStops.length > 0) {
    throw new ConflictError(
      'Todavía hay paradas pendientes por completar',
      'ROUTE_HAS_PENDING_STOPS'
    );
  }

  await prisma.$transaction([
    prisma.route.update({
      where: { id: route.id },
      data: { status: RouteStatus.completed, endedAt: new Date() },
    }),
    prisma.driver.update({
      where: { userId: driverId },
      data: { status: DriverStatus.available },
    }),
  ]);

  const updated = await getDriverRoute(companyId, driverId, route.id);
  emitToCompany(companyId, 'route:status', {
    routeId: route.id,
    driverId,
    status: updated.status,
    route: updated,
  });
  return updated;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export async function recordRouteLocations(
  companyId: string,
  driverId: string,
  routeId: string,
  locations: Array<{
    latitude: number;
    longitude: number;
    capturedAt: Date | string;
    isOffline: boolean;
  }>
) {
  const route = await findDriverRoute(companyId, driverId, routeId);

  if (route.status !== RouteStatus.in_progress) {
    throw new ConflictError('La ruta no está en curso', 'ROUTE_NOT_IN_PROGRESS');
  }

  const uniqueLocations = new Map<
    string,
    { latitude: number; longitude: number; capturedAt: Date; isOffline: boolean }
  >();
  for (const location of locations) {
    const capturedAt = toDate(location.capturedAt);
    uniqueLocations.set(capturedAt.toISOString(), { ...location, capturedAt });
  }

  const capturedDates = [...uniqueLocations.keys()].map((value) => new Date(value));
  const existing = await prisma.routeLocation.findMany({
    where: { routeId: route.id, capturedAt: { in: capturedDates } },
    select: { capturedAt: true },
  });
  const existingDates = new Set(existing.map((item) => item.capturedAt.toISOString()));

  const pending = [...uniqueLocations.entries()]
    .filter(([key]) => !existingDates.has(key))
    .map(([, location]) => ({
      routeId: route.id,
      latitude: location.latitude,
      longitude: location.longitude,
      capturedAt: location.capturedAt,
      isOffline: location.isOffline,
    }));

  if (pending.length > 0) {
    await prisma.routeLocation.createMany({ data: pending });
    emitToCompany(companyId, 'route:location', {
      routeId: route.id,
      driverId,
      locations: pending.map((location) => ({
        latitude: location.latitude,
        longitude: location.longitude,
        capturedAt: location.capturedAt.toISOString(),
        isOffline: location.isOffline,
      })),
    });
  }

  return { accepted: locations.length, inserted: pending.length };
}

function stopTargetCoordinates(stop: RouteWithRelations['stops'][number]) {
  const source = stop.order ?? stop.student;
  if (!source || source.latitude === null || source.longitude === null) {
    return null;
  }

  return {
    latitude: Number(source.latitude),
    longitude: Number(source.longitude),
  };
}

export async function arriveAtStop(
  companyId: string,
  driverId: string,
  routeId: string,
  stopId: string,
  data: { latitude?: number; longitude?: number; method: 'geofence' | 'manual' }
) {
  const route = await findDriverRoute(companyId, driverId, routeId);

  if (route.status !== RouteStatus.in_progress) {
    throw new ConflictError('La ruta no está en curso', 'ROUTE_NOT_IN_PROGRESS');
  }

  const stop = route.stops.find((item) => item.id === stopId);
  if (!stop) {
    throw new NotFoundError('Parada no encontrada', 'STOP_NOT_FOUND');
  }

  if (stop.status === StopStatus.completed) {
    throw new ConflictError('La parada ya fue completada', 'STOP_ALREADY_COMPLETED');
  }

  if (stop.status === StopStatus.arrived) {
    return serializeRoute(route);
  }

  assertBothCoordinates(data);
  let isGeofenceVerified = false;

  if (data.method === 'geofence') {
    if (data.latitude === undefined || data.longitude === undefined) {
      throw new BadRequestError(
        'La latitud y longitud son obligatorias para verificar la geocerca',
        'COORDINATES_REQUIRED'
      );
    }

    const target = stopTargetCoordinates(stop);
    if (!target) {
      throw new ConflictError(
        'La parada no tiene coordenadas para verificar la geocerca',
        'STOP_WITHOUT_COORDINATES'
      );
    }

    const distanceMeters = haversineMeters(
      { latitude: data.latitude, longitude: data.longitude },
      target
    );

    if (distanceMeters > GEOFENCE_RADIUS_M) {
      throw new ConflictError(
        'Estás fuera del radio permitido para marcar la llegada',
        'OUTSIDE_GEOFENCE'
      );
    }

    isGeofenceVerified = true;
  }

  await prisma.routeStop.update({
    where: { id: stop.id },
    data: {
      status: StopStatus.arrived,
      arrivedAt: new Date(),
      isGeofenceVerified,
      syncedAt: new Date(),
    },
  });

  const updated = await getDriverRoute(companyId, driverId, route.id);
  emitToCompany(companyId, 'route:stop-status', {
    routeId: route.id,
    driverId,
    stopId: stop.id,
    status: StopStatus.arrived,
    route: updated,
  });
  return updated;
}

export async function completeDriverStop(
  companyId: string,
  driverId: string,
  routeId: string,
  stopId: string,
  data: {
    evidence: Array<{ photoUrl: string; capturedAt?: Date | string }>;
    notes?: string;
    recipientName?: string;
  }
) {
  const route = await findDriverRoute(companyId, driverId, routeId);

  if (route.status !== RouteStatus.in_progress) {
    throw new ConflictError('La ruta no está en curso', 'ROUTE_NOT_IN_PROGRESS');
  }

  const stop = route.stops.find((item) => item.id === stopId);
  if (!stop) {
    throw new NotFoundError('Parada no encontrada', 'STOP_NOT_FOUND');
  }

  if (stop.status === StopStatus.completed) {
    return serializeRoute(route);
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.evidencePhoto.createMany({
      data: data.evidence.map((photo) => ({
        stopId: stop.id,
        photoUrl: photo.photoUrl,
        capturedAt: photo.capturedAt ? toDate(photo.capturedAt) : now,
      })),
    });

    await tx.routeStop.update({
      where: { id: stop.id },
      data: {
        status: StopStatus.completed,
        arrivedAt: stop.arrivedAt ?? now,
        confirmedAt: now,
        syncedAt: now,
        notes: data.notes,
        recipientName: data.recipientName,
      },
    });

    if (stop.orderId) {
      await tx.order.update({
        where: { id: stop.orderId },
        data: { status: OrderStatus.completed },
      });
    }
  });

  const updated = await getDriverRoute(companyId, driverId, route.id);
  emitToCompany(companyId, 'route:stop-status', {
    routeId: route.id,
    driverId,
    stopId: stop.id,
    status: StopStatus.completed,
    route: updated,
  });
  return updated;
}

export async function reassignRoute(companyId: string, routeId: string, newDriverId: string) {
  const route = await prisma.route.findFirst({
    where: { id: routeId, companyId },
    include: { driver: true },
  });

  if (!route) {
    throw new NotFoundError('Ruta no encontrada', 'ROUTE_NOT_FOUND');
  }

  if (route.status === RouteStatus.completed || route.status === RouteStatus.cancelled) {
    throw new ConflictError('La ruta ya no se puede reasignar', 'ROUTE_NOT_REASSIGNABLE');
  }

  if (route.driverId === newDriverId) {
    return getRouteById(companyId, route.id);
  }

  const newDriver = await findDriver(companyId, newDriverId);
  if (newDriver.driver?.status === DriverStatus.unavailable) {
    throw new ConflictError('El conductor no está disponible', 'DRIVER_NOT_AVAILABLE');
  }

  if (route.status === RouteStatus.in_progress) {
    const activeRoute = await prisma.route.findFirst({
      where: {
        companyId,
        driverId: newDriverId,
        status: RouteStatus.in_progress,
        id: { not: route.id },
      },
      select: { id: true },
    });

    if (activeRoute) {
      throw new ConflictError(
        'El conductor ya tiene otra ruta en curso',
        'DRIVER_HAS_ACTIVE_ROUTE'
      );
    }
  }

  await prisma.$transaction([
    prisma.route.update({
      where: { id: route.id },
      data: { driverId: newDriverId },
    }),
    prisma.driver.update({
      where: { userId: route.driverId },
      data: { status: DriverStatus.available },
    }),
    prisma.driver.update({
      where: { userId: newDriverId },
      data: {
        status:
          route.status === RouteStatus.in_progress
            ? DriverStatus.on_route
            : newDriver.driver?.status ?? DriverStatus.available,
      },
    }),
  ]);

  const updated = await getRouteById(companyId, route.id);
  const payload = {
    routeId: route.id,
    previousDriverId: route.driverId,
    driverId: newDriverId,
    route: updated,
  };
  emitToCompany(companyId, 'route:reassigned', payload);
  return updated;
}

export async function reassignStop(
  companyId: string,
  routeId: string,
  stopId: string,
  newDriverId: string
) {
  const route = await prisma.route.findFirst({
    where: { id: routeId, companyId },
    include: { stops: true },
  });

  if (!route) {
    throw new NotFoundError('Ruta no encontrada', 'ROUTE_NOT_FOUND');
  }

  if (route.status === RouteStatus.completed || route.status === RouteStatus.cancelled) {
    throw new ConflictError('La ruta ya no se puede reasignar', 'ROUTE_NOT_REASSIGNABLE');
  }

  const stop = route.stops.find((item) => item.id === stopId);
  if (!stop) {
    throw new NotFoundError('Parada no encontrada', 'STOP_NOT_FOUND');
  }

  if (stop.status === StopStatus.completed) {
    throw new ConflictError('La parada ya fue completada', 'STOP_ALREADY_COMPLETED');
  }

  if (route.driverId === newDriverId) {
    return getRouteById(companyId, route.id);
  }

  const newDriver = await findDriver(companyId, newDriverId);
  if (newDriver.driver?.status === DriverStatus.unavailable) {
    throw new ConflictError('El conductor no está disponible', 'DRIVER_NOT_AVAILABLE');
  }

  if (route.status === RouteStatus.in_progress) {
    const activeRoute = await prisma.route.findFirst({
      where: {
        companyId,
        driverId: newDriverId,
        status: RouteStatus.in_progress,
        id: { not: route.id },
      },
      select: { id: true },
    });

    if (activeRoute) {
      throw new ConflictError(
        'El conductor ya tiene otra ruta en curso',
        'DRIVER_HAS_ACTIVE_ROUTE'
      );
    }
  }

  const targetRoute = await prisma.$transaction(async (tx) => {
    let target = await tx.route.findFirst({
      where: {
        companyId,
        driverId: newDriverId,
        routeDate: route.routeDate,
        status: {
          in: [RouteStatus.created, RouteStatus.optimized, RouteStatus.in_progress],
        },
      },
      orderBy: { id: 'asc' },
    });

    if (!target) {
      target = await tx.route.create({
        data: {
          companyId,
          driverId: newDriverId,
          routeDate: route.routeDate,
          status: RouteStatus.created,
        },
      });
    }

    const sequence = await tx.routeStop.aggregate({
      where: { routeId: target.id },
      _max: { sequence: true },
    });

    await tx.routeStop.update({
      where: { id: stop.id },
      data: {
        routeId: target.id,
        sequence: (sequence._max.sequence ?? 0) + 1,
      },
    });

    if (route.status === RouteStatus.in_progress) {
      await tx.driver.update({
        where: { userId: newDriverId },
        data: { status: DriverStatus.on_route },
      });
    }

    return target;
  });

  const updatedTarget = await getRouteById(companyId, targetRoute.id);
  emitToCompany(companyId, 'route:stop-reassigned', {
    routeId: route.id,
    stopId: stop.id,
    targetRouteId: targetRoute.id,
    previousDriverId: route.driverId,
    driverId: newDriverId,
    route: updatedTarget,
  });
  return updatedTarget;
}

export async function createEvidenceSignature(
  companyId: string,
  driverId: string,
  routeId: string,
  stopId: string
) {
  const route = await findDriverRoute(companyId, driverId, routeId);

  if (route.status !== RouteStatus.in_progress) {
    throw new ConflictError('La ruta no está en curso', 'ROUTE_NOT_IN_PROGRESS');
  }

  const stop = route.stops.find((item) => item.id === stopId);
  if (!stop) {
    throw new NotFoundError('Parada no encontrada', 'STOP_NOT_FOUND');
  }

  if (stop.status === StopStatus.completed) {
    throw new ConflictError('La parada ya fue completada', 'STOP_ALREADY_COMPLETED');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `fastrouteco/evidence/${companyId}/${routeId}/${stopId}`;
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    env.CLOUDINARY_API_SECRET
  );

  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    folder,
    signature,
  };
}

async function resolveStartPoint(
  companyId: string,
  route: { driverId: string; startLatitude: Prisma.Decimal | null; startLongitude: Prisma.Decimal | null },
  firstStop: Coordinates
): Promise<Coordinates> {
  if (route.startLatitude !== null && route.startLongitude !== null) {
    return {
      latitude: Number(route.startLatitude),
      longitude: Number(route.startLongitude),
    };
  }

  const lastLocation = await prisma.routeLocation.findFirst({
    where: { route: { driverId: route.driverId, companyId } },
    orderBy: { capturedAt: 'desc' },
    select: { latitude: true, longitude: true },
  });

  if (lastLocation) {
    return {
      latitude: Number(lastLocation.latitude),
      longitude: Number(lastLocation.longitude),
    };
  }

  return firstStop;
}

export async function optimizeRoute(companyId: string, routeId: string) {
  const route = await prisma.route.findFirst({
    where: { id: routeId, companyId },
    include: {
      stops: {
        include: { order: true },
        orderBy: { sequence: 'asc' },
      },
    },
  });

  if (!route) {
    throw new NotFoundError('Ruta no encontrada', 'ROUTE_NOT_FOUND');
  }

  if (route.status !== RouteStatus.created && route.status !== RouteStatus.optimized) {
    throw new ConflictError('La ruta ya no se puede optimizar', 'ROUTE_NOT_OPTIMIZABLE');
  }

  if (route.stops.length === 0) {
    throw new ConflictError('La ruta no tiene paradas para optimizar', 'ROUTE_WITHOUT_STOPS');
  }

  const unlocated = route.stops.filter(
    (stop) =>
      !stop.order ||
      stop.order.latitude === null ||
      stop.order.longitude === null
  );

  if (unlocated.length > 0) {
    throw new ConflictError(
      'Todas las paradas deben tener coordenadas para optimizar la ruta',
      'ROUTE_STOPS_WITHOUT_COORDINATES'
    );
  }

  await assertOptimizationAllowed(companyId);
  await processClosingUsageCharges(companyId);

  const stops = route.stops.map((stop) => ({
    id: stop.id,
    order: stop.order as NonNullable<typeof stop.order>,
    latitude: Number(stop.order!.latitude),
    longitude: Number(stop.order!.longitude),
  }));

  const start = await resolveStartPoint(companyId, route, {
    latitude: stops[0].latitude,
    longitude: stops[0].longitude,
  });

  const startedAt = performance.now();
  const matrix = await getRoutingEngine().distanceMatrix([
    start,
    ...stops.map((stop) => ({ latitude: stop.latitude, longitude: stop.longitude })),
  ]);

  const order = optimizeStopOrder(matrix.distances, stops.length);
  const totalDistanceM = Math.round(totalPathDistance(matrix.distances, order));
  const estimatedDurationS = Math.round(totalPathDuration(matrix.durations, order));
  const processingTimeMs = Math.round(performance.now() - startedAt);

  const { optimization, billing } = await prisma.$transaction(async (tx) => {
    for (let index = 0; index < route.stops.length; index += 1) {
      await tx.routeStop.update({
        where: { id: route.stops[index].id },
        data: { sequence: -(index + 1) },
      });
    }

    for (let index = 0; index < order.length; index += 1) {
      await tx.routeStop.update({
        where: { id: stops[order[index]].id },
        data: { sequence: index + 1 },
      });
    }

    await tx.route.update({
      where: { id: route.id },
      data: {
        status: RouteStatus.optimized,
        startLatitude: route.startLatitude ?? start.latitude,
        startLongitude: route.startLongitude ?? start.longitude,
      },
    });

    const created = await tx.routeOptimization.create({
      data: {
        routeId: route.id,
        totalDistanceM,
        estimatedDurationS,
        processingTimeMs,
        isSuccessful: true,
      },
    });
    const billingResult = await applyOptimizationBilling(tx, companyId, created.id);

    return { optimization: created, billing: billingResult };
  });

  if (billing.mode === 'pay_per_use') {
    try {
      await checkSpendingWarning(companyId);
      const threshold = billing.earlyChargeThreshold;
      if (threshold !== null && threshold > 0 && billing.amount >= threshold) {
        await processUsageCharge(companyId, billing.usageChargeId);
      }
    } catch (error) {
      console.error('[billing] No se pudo procesar el cobro de pago por uso:', error);
    }
  }

  return {
    ...(await getRouteById(companyId, route.id)),
    optimization,
    approximate: matrix.approximate,
    billing,
  };
}
