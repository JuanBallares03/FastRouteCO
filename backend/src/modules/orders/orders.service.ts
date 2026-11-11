import {
  OrderChannel,
  OrderPriority,
  OrderStatus,
  OrderType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getGeocoder } from '../../lib/geocoding.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';

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
      'No se pudo geocodificar la dirección. Verifica que sea válida.',
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
