import {
  DriverStatus,
  OrderStatus,
  Prisma,
  RouteStatus,
  StopStatus,
  UserRole,
} from '@prisma/client';
import { performance } from 'node:perf_hooks';
import { prisma } from '../../lib/prisma.js';
import { parseBusinessDate, todayInBogota } from '../../lib/dates.js';
import { haversineMeters } from '../../lib/geo.js';
import {
  optimizeStopOrder,
  totalPathDistance,
  totalPathDuration,
} from '../../lib/optimization.js';
import { getRoutingEngine } from '../../lib/routing.js';
import type { Coordinates } from '../../lib/geocoding.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';

const ACTIVE_ROUTE_STATUSES: RouteStatus[] = [
  RouteStatus.created,
  RouteStatus.optimized,
  RouteStatus.in_progress,
];

const routeInclude = {
  stops: {
    include: {
      order: true,
      student: true,
    },
    orderBy: { sequence: 'asc' },
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

  const optimization = await prisma.$transaction(async (tx) => {
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

    return tx.routeOptimization.create({
      data: {
        routeId: route.id,
        totalDistanceM,
        estimatedDurationS,
        processingTimeMs,
        isSuccessful: true,
      },
    });
  });

  return {
    ...(await getRouteById(companyId, route.id)),
    optimization,
    approximate: matrix.approximate,
  };
}
