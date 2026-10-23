import { z } from 'zod';

export const updateCompanySchema = z.object({
  body: z.object({
    email: z.string().email({ message: 'Email inválido' }).max(150).optional(),
    phone: z.string().max(30).optional(),
    address: z.string().max(255).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const getCompanySchema = z.object({});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>['body'];