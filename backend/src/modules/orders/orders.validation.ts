import { z } from 'zod';

const orderType = z.enum(['delivery', 'pickup']);
const orderPriority = z.enum(['normal', 'urgent']);
const orderChannel = z.enum(['whatsapp', 'phone_call', 'in_person']);
const orderStatus = z.enum(['pending', 'assigned', 'completed', 'cancelled']);

const orderFields = {
  type: orderType.optional(),
  address: z.string().min(5, { message: 'Dirección requerida' }).max(255).optional(),
  priority: orderPriority.optional(),
  customerName: z.string().max(150).optional(),
  customerPhone: z.string().max(30).optional(),
  description: z.string().max(2000).optional(),
  channel: orderChannel.optional(),
  branchId: z.string().uuid({ message: 'ID de sede inválido' }).optional(),
};

export const createOrderSchema = z.object({
  body: z.object({
    ...orderFields,
    type: orderType,
    address: z.string().min(5, { message: 'Dirección requerida' }).max(255),
  }),
});

export const updateOrderSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de pedido inválido' }),
  }),
  body: z
    .object(orderFields)
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'Debes enviar al menos un campo para actualizar',
    }),
});

export const getOrderSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de pedido inválido' }),
  }),
});

export const cancelOrderSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de pedido inválido' }),
  }),
});

export const listOrdersSchema = z.object({
  query: z.object({
    status: orderStatus.optional(),
    priority: orderPriority.optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  }),
});

const businessDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha de ruta inválida' })
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, { message: 'Fecha de ruta inválida' });

export const suggestDriversSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de pedido inválido' }),
  }),
});

export const assignOrderSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de pedido inválido' }),
  }),
  body: z.object({
    driverId: z.string().uuid({ message: 'ID de conductor inválido' }),
    routeDate: businessDate.optional(),
  }),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>['body'];
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>['body'];
export type AssignOrderInput = z.infer<typeof assignOrderSchema>['body'];
