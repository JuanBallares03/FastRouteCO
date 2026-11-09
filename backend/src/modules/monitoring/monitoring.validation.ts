import { z } from 'zod';

const alertSeverity = z.enum(['info', 'warning', 'critical']);

export const listAlertsSchema = z.object({
  query: z.object({
    severity: alertSeverity.optional(),
    resolved: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export const alertParamsSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(/^\d+$/, { message: 'ID de alerta inválido' }),
  }),
});

export type ListAlertsInput = z.infer<typeof listAlertsSchema>['query'];
