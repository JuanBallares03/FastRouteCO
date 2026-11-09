import { z } from 'zod';

const supportStatus = z.enum(['open', 'answered', 'closed']);

export const createSupportRequestSchema = z.object({
  body: z.object({
    subject: z
      .string()
      .trim()
      .min(5, { message: 'El asunto debe tener al menos 5 caracteres' })
      .max(200, { message: 'El asunto no puede superar 200 caracteres' }),
    description: z
      .string()
      .trim()
      .min(10, { message: 'La descripción debe tener al menos 10 caracteres' })
      .max(5000, { message: 'La descripción no puede superar 5000 caracteres' }),
  }),
});

export const listSupportRequestsSchema = z.object({
  query: z.object({
    status: supportStatus.optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export const supportRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de solicitud inválido' }),
  }),
});

export const respondSupportRequestSchema = z.object({
  params: supportRequestSchema.shape.params,
  body: z.object({
    response: z
      .string()
      .trim()
      .min(5, { message: 'La respuesta debe tener al menos 5 caracteres' })
      .max(5000, { message: 'La respuesta no puede superar 5000 caracteres' }),
  }),
});

export type CreateSupportRequestInput = z.infer<typeof createSupportRequestSchema>['body'];
export type ListSupportRequestsInput = z.infer<typeof listSupportRequestsSchema>['query'];
export type RespondSupportRequestInput = z.infer<
  typeof respondSupportRequestSchema
>['body'];
