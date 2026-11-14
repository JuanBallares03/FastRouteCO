import {
  DriverStatus,
  OrderChannel,
  OrderPriority,
  OrderStatus,
  OrderType,
  Prisma,
  RouteStatus,
  StopStatus,
  UserRole,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getGeocoder } from '../../lib/geocoding.js';
import { haversineMeters } from '../../lib/geo.js';
import { parseBusinessDate, todayInBogota } from '../../lib/dates.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { ACTIVE_ROUTE_STATUSES, MAX_ROUTE_STOPS } from '../routes/constants.js';
import { findDriver, getRouteById } from '../routes/routes.service.js';

export interface CreateOrderInput {
  type: OrderType;
  address: string;
  priority?: OrderPriority;
  customerName?: string;
  customerPhone?: string;
  description?: string;
  channel?: OrderChannel;
  branchId?: string;
}

export type UpdateOrderInput = Partial<CreateOrderInput>;

export interface ListOrdersFilters {
  status?: OrderStatus;
  priority?: OrderPriority;
  search?: string;
  page: number;
  pageSize: number;
}

interface GeocodingOutcome {
  latitude: number | null;
  longitude: number | null;
  warning?: string;
}

const editableStatuses: OrderStatus[] = [OrderStatus.pending, OrderStatus.assigned];

async function geocodeAddress(address: string): Promise<GeocodingOutcome> {
  let result;
  try {
    result = await getGeocoder().geocode(address);
  } catch {
    return {
      latitude: null,
      longitude: null,
      warning:
        'La dirección no se pudo geocodificar en este momento. El pedido se guardó sin coordenadas.',
    };
  }

  if (!result) {
    throw new BadRequestError(
      'No encontramos esa dirección en el mapa. Revisa la dirección o escribe un lugar conocido de Ibagué',
      'ADDRESS_NOT_FOUND'
    );
  }

  return {
    latitude: result.latitude,
    longitude: result.longitude,
  };
}

async function assertBranchBelongsToCompany(companyId: string, branchId?: string) {
  if (!branchId) return;
  const branch = await prisma.branch.findFirst({ where: { id: branchId, companyId } });
  if (!branch) {
    throw new NotFoundError('Sede no encontrada', 'BRANCH_NOT_FOUND');
  }
}

function serializeOrder<T extends { latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null }>(
  order: T
) {
  return {
    ...order,
    latitude: order.latitude === null ? null : Number(order.latitude),
    longitude: order.longitude === null ? null : Number(order.longitude),
  };
}

export async function createOrder(companyId: string, input: CreateOrderInput) {
  await assertBranchBelongsToCompany(companyId, input.branchId);

  const geocoding = await geocodeAddress(input.address);

  const order = await prisma.order.create({
    data: {
      companyId,
      branchId: input.branchId,
      type: input.type,
      address: input.address,
      priority: input.priority ?? OrderPriority.normal,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      description: input.description,
      channel: input.channel,
      latitude: geocoding.latitude,
      longitude: geocoding.longitude,
      status: OrderStatus.pending,
    },
    include: { branch: { select: { id: true, name: true } } },
  });

  return {
    ...serializeOrder(order),
    geocoded: geocoding.latitude !== null,
    warning: geocoding.warning,
  };
}

export async function listOrders(companyId: string, filters: ListOrdersFilters) {
  const where: Prisma.OrderWhereInput = {
    companyId,
    status: filters.status,
    priority: filters.priority,
    ...(filters.search
      ? {
          OR: [
            { address: { contains: filters.search, mode: 'insensitive' } },
            { customerName: { contains: filters.search, mode: 'insensitive' } },
            { description: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      include: { branch: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items: items.map((order) => serializeOrder(order)),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getOrderById(companyId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    include: {
      branch: { select: { id: true, name: true } },
      routeStops: {
        include: {
          route: { select: { id: true, driverId: true, routeDate: true, status: true } },
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Pedido no encontrado', 'ORDER_NOT_FOUND');
  }

  return serializeOrder(order);
}

export async function updateOrder(
  companyId: string,
  orderId: string,
  input: UpdateOrderInput
) {
  const order = await prisma.order.findFirst({ where: { id: orderId, companyId } });
  if (!order) {
    throw new NotFoundError('Pedido no encontrado', 'ORDER_NOT_FOUND');
  }
  if (!editableStatuses.includes(order.status)) {
    throw new ConflictError('Solo se pueden editar pedidos pendientes o asignados', 'ORDER_NOT_EDITABLE');
  }

  await assertBranchBelongsToCompany(companyId, input.branchId);

  const addressChanged = Boolean(input.address && input.address !== order.address);
  const coordinates = addressChanged
    ? await geocodeAddress(input.address as string)
    : null;

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      type: input.type,
      address: input.address,
      priority: input.priority,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      description: input.description,
      channel: input.channel,
      branchId: input.branchId,
      latitude: addressChanged ? (coordinates?.latitude ?? null) : undefined,
      longitude: addressChanged ? (coordinates?.longitude ?? null) : undefined,
    },
    include: { branch: { select: { id: true, name: true } } },
  });

  return {
    ...serializeOrder(updated),
    geocoded: updated.latitude !== null,
    warning: coordinates?.warning,
  };
}

export async function cancelOrder(companyId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    include: {
      routeStops: {
        include: { route: true },
        orderBy: { sequence: 'asc' },
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Pedido no encontrado', 'ORDER_NOT_FOUND');
  }
  if (!editableStatuses.includes(order.status)) {
    throw new ConflictError('Solo se pueden cancelar pedidos pendientes o asignados', 'ORDER_NOT_CANCELLABLE');
  }

  await prisma.$transaction(async (tx) => {
    for (const stop of order.routeStops) {
      await tx.routeStop.delete({ where: { id: stop.id } });

      const remaining = await tx.routeStop.findMany({
        where: { routeId: stop.routeId },
        orderBy: { sequence: 'asc' },
      });

      for (const [index, remainingStop] of remaining.entries()) {
        if (remainingStop.sequence !== index + 1) {
          await tx.routeStop.update({
            where: { id: remainingStop.id },
            data: { sequence: index + 1 },
          });
        }
      }

      if (remaining.length === 0) {
        await tx.route.delete({ where: { id: stop.routeId } });
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.cancelled },
    });
  });

  return { id: orderId, status: OrderStatus.cancelled };
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
    const claimed = await tx.order.updateMany({
      where: { id: orderId, companyId, status: OrderStatus.pending },
      data: { status: OrderStatus.assigned },
    });
    if (claimed.count === 0) {
      throw new ConflictError('El pedido ya está en una ruta', 'ORDER_ALREADY_ASSIGNED');
    }

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

    const stopCount = await tx.routeStop.count({ where: { routeId: target.id } });
    if (stopCount >= MAX_ROUTE_STOPS) {
      throw new ConflictError(
        `La ruta no puede superar ${MAX_ROUTE_STOPS} paradas`,
        'ROUTE_STOP_LIMIT_EXCEEDED'
      );
    }

    const aggregate = await tx.routeStop.aggregate({
      where: { routeId: target.id },
      _max: { sequence: true },
    });
    const nextSequence = (aggregate._max.sequence ?? 0) + 1;

    await tx.routeStop.create({
      data: { routeId: target.id, orderId, sequence: nextSequence },
    });

    return target;
  });

  const assigned = await getRouteById(companyId, route.id);
  return { orderId, driverId: data.driverId, route: assigned };
}
