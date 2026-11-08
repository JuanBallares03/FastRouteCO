import { z } from 'zod';

const incidentCategory = z.enum(['incident', 'question']);
const incidentStatus = z.enum(['open', 'in_progress', 'resolved']);

const idParams = z.object({
  id: z.string().uuid({ message: 'ID de incidencia inválido' }),
});

export const createIncidentSchema = z.object({
  body: z.object({
    routeId: z.string().uuid({ message: 'ID de ruta inválido' }),
    stopId: z.string().uuid({ message: 'ID de parada inválido' }).optional(),
    category: incidentCategory,
    description: z
      .string()
      .trim()
      .min(5, { message: 'Describe la incidencia con al menos 5 caracteres' })
      .max(2000),
  }),
});

export const listIncidentsSchema = z.object({
  query: z.object({
    routeId: z.string().uuid().optional(),
    status: incidentStatus.optional(),
    category: incidentCategory.optional(),
  }),
});

export const incidentIdSchema = z.object({
  params: idParams,
});

export const addIncidentMessageSchema = z.object({
  params: idParams,
  body: z.object({
    message: z
      .string()
      .trim()
      .min(1, { message: 'El mensaje no puede estar vacío' })
      .max(2000),
  }),
});

export const updateIncidentSchema = z.object({
  params: idParams,
  body: z
    .object({
      status: incidentStatus.optional(),
      resolutionNotes: z.string().trim().max(2000).optional(),
    })
    .refine((value) => value.status !== undefined || value.resolutionNotes !== undefined, {
      message: 'Debes enviar un estado o una nota de resolución',
    }),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>['body'];
export type ListIncidentsInput = z.infer<typeof listIncidentsSchema>['query'];
export type AddIncidentMessageInput = z.infer<typeof addIncidentMessageSchema>['body'];
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>['body'];
