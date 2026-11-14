import type { NextFunction, Request, Response } from 'express';
import { OrderPriority, OrderStatus } from '@prisma/client';
import {
  assignOrder,
  cancelOrder,
  createOrder,
  getOrderById,
  listOrders,
  suggestDrivers,
  updateOrder,
  type CreateOrderInput,
  type UpdateOrderInput,
} from './orders.service.js';
import type { AssignOrderInput } from './orders.validation.js';
import { respondWithError } from '../../middleware/error-handler.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    companyId: string | null;
    isActive: boolean;
  };
}

function requireCompanyId(req: AuthenticatedRequest, res: Response): string | null {
  const companyId = req.user?.companyId;
  if (!companyId) {
    res.status(403).json({ message: 'Sin empresa asociada' });
    return null;
  }
  return companyId;
}

export async function createOrderHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const order = await createOrder(companyId, req.body as CreateOrderInput);
    res.status(201).json(order);
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function listOrdersHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { status, priority, search, page, pageSize } = req.query as {
      status?: string;
      priority?: string;
      search?: string;
      page?: string;
      pageSize?: string;
    };

    const result = await listOrders(companyId, {
      status: status as OrderStatus | undefined,
      priority: priority as OrderPriority | undefined,
      search,
      page: parseInt(page ?? '1', 10),
      pageSize: parseInt(pageSize ?? '20', 10),
    });

    res.json(result);
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function getOrderHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params as { id: string };
    res.json(await getOrderById(companyId, id));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function updateOrderHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params as { id: string };
    res.json(await updateOrder(companyId, id, req.body as UpdateOrderInput));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function cancelOrderHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params as { id: string };
    res.json(await cancelOrder(companyId, id));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function suggestDriversHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params as { id: string };
    res.json(await suggestDrivers(companyId, id));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}

export async function assignOrderHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;

    const { id } = req.params as { id: string };
    res.json(await assignOrder(companyId, id, req.body as AssignOrderInput));
  } catch (error) {
    if (respondWithError(error, res)) return;
    next(error);
  }
}
