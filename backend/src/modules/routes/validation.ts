import { z } from 'zod';

const businessDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha de ruta inválida' })
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, { message: 'Fecha de ruta inválida' });

const routeStatus = z.enum(['created', 'optimized', 'in_progress', 'completed', 'cancelled']);

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

export const createRouteSchema = z.object({
  body: z
    .object({
      driverId: z.string().uuid({ message: 'ID de conductor inválido' }),
      routeDate: businessDate,
      orderIds: z
        .array(z.string().uuid({ message: 'ID de pedido inválido' }))
        .default([])
        .refine((ids) => new Set(ids).size === ids.length, {
          message: 'La ruta no puede repetir pedidos',
        }),
      studentIds: z
        .array(z.string().uuid({ message: 'ID de estudiante inválido' }))
        .default([])
        .refine((ids) => new Set(ids).size === ids.length, {
          message: 'La ruta no puede repetir estudiantes',
        }),
    })
    .refine((data) => data.orderIds.length + data.studentIds.length > 0, {
      message: 'La ruta debe incluir al menos un pedido o estudiante',
      path: ['orderIds'],
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

export const driverRouteSchema = getRouteSchema;

export const startRouteSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de ruta inválido' }),
  }),
  body: z.object({
    latitude: latitude.optional(),
    longitude: longitude.optional(),
  }),
});

export const finishRouteSchema = getRouteSchema;

export const routeLocationsSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de ruta inválido' }),
  }),
  body: z.object({
    locations: z
      .array(
        z.object({
          latitude,
          longitude,
          capturedAt: z.coerce.date(),
          isOffline: z.boolean().optional().default(false),
        })
      )
      .min(1, { message: 'Debes enviar al menos una ubicación' })
      .max(500, { message: 'Puedes enviar hasta 500 ubicaciones por lote' }),
  }),
});

export const stopParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de ruta inválido' }),
    stopId: z.string().uuid({ message: 'ID de parada inválido' }),
  }),
});

export const arriveAtStopSchema = z.object({
  params: stopParamsSchema.shape.params,
  body: z.object({
    latitude: latitude.optional(),
    longitude: longitude.optional(),
    method: z.enum(['geofence', 'manual']).default('geofence'),
  }),
});

export const completeStopSchema = z.object({
  params: stopParamsSchema.shape.params,
  body: z.object({
    evidence: z
      .array(
        z.object({
          photoUrl: z.string().url({ message: 'URL de evidencia inválida' }),
          capturedAt: z.coerce.date().optional(),
        })
      )
      .min(1, { message: 'Debes adjuntar al menos una foto de evidencia' })
      .max(5, { message: 'Puedes adjuntar hasta 5 fotos por parada' }),
    notes: z.string().trim().max(1000).optional(),
    recipientName: z.string().trim().max(150).optional(),
  }),
});

export const reassignRouteSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de ruta inválido' }),
  }),
  body: z.object({
    driverId: z.string().uuid({ message: 'ID de conductor inválido' }),
  }),
});

export const reassignStopSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de ruta inválido' }),
    stopId: z.string().uuid({ message: 'ID de parada inválido' }),
  }),
  body: z.object({
    driverId: z.string().uuid({ message: 'ID de conductor inválido' }),
  }),
});

export type StartRouteInput = z.infer<typeof startRouteSchema>['body'];
export type RouteLocationsInput = z.infer<typeof routeLocationsSchema>['body'];
export type ArriveAtStopInput = z.infer<typeof arriveAtStopSchema>['body'];
export type CompleteStopInput = z.infer<typeof completeStopSchema>['body'];
export type ReassignRouteInput = z.infer<typeof reassignRouteSchema>['body'];
export type ReassignStopInput = z.infer<typeof reassignStopSchema>['body'];

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
