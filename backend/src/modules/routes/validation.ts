import { z } from 'zod';

const businessDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha de ruta inválida' })
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, { message: 'Fecha de ruta inválida' });

const routeStatus = z.enum(['created', 'optimized', 'in_progress', 'completed', 'cancelled']);

export const createRouteSchema = z.object({
  body: z.object({
    driverId: z.string().uuid({ message: 'ID de conductor inválido' }),
    routeDate: businessDate,
    orderIds: z
      .array(z.string().uuid({ message: 'ID de pedido inválido' }))
      .min(1, { message: 'La ruta debe incluir al menos un pedido' })
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'La ruta no puede repetir pedidos',
      }),
  }),
});

export const listRoutesSchema = z.object({
  query: z.object({
    date: businessDate.optional(),
    driverId: z.string().uuid().optional(),
    status: routeStatus.optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export const getRouteSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de ruta inválido' }),
  }),
});

export const optimizeRouteSchema = getRouteSchema;

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

export type CreateRouteInput = z.infer<typeof createRouteSchema>['body'];
export type AssignOrderInput = z.infer<typeof assignOrderSchema>['body'];
