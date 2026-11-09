import { z } from 'zod';

const address = z
  .string()
  .trim()
  .min(5, { message: 'Dirección de recogida requerida' })
  .max(255, { message: 'La dirección no puede superar 255 caracteres' });

export const listStudentsSchema = z.object({
  query: z.object({
    active: z.enum(['true', 'false']).optional(),
  }),
});

export const createStudentSchema = z.object({
  body: z.object({
    fullName: z
      .string()
      .trim()
      .min(3, { message: 'El nombre debe tener al menos 3 caracteres' })
      .max(150, { message: 'El nombre no puede superar 150 caracteres' }),
    pickupAddress: address,
  }),
});

export const studentParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de estudiante inválido' }),
  }),
});

export const updateStudentSchema = z.object({
  params: studentParamsSchema.shape.params,
  body: z
    .object({
      fullName: z.string().trim().min(3).max(150).optional(),
      pickupAddress: address.optional(),
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'Debes enviar al menos un campo para actualizar',
    }),
});

export const updateStudentStatusSchema = z.object({
  params: studentParamsSchema.shape.params,
  body: z.object({
    isActive: z.boolean(),
  }),
});

export type ListStudentsInput = z.infer<typeof listStudentsSchema>['query'];
export type CreateStudentInput = z.infer<typeof createStudentSchema>['body'];
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>['body'];
