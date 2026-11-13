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

export const listBranchesSchema = z.object({});

export const createBranchSchema = z.object({
  body: z.object({
    name: z.string().min(1, { message: 'Nombre de sede requerido' }).max(100),
    address: z.string().max(255).optional(),
  }),
});

export const updateBranchSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de sede inválido' }),
  }),
  body: z.object({
    name: z.string().min(1, { message: 'Nombre de sede requerido' }).max(100).optional(),
    address: z.string().max(255).optional(),
  }),
});

export const listSupervisorsSchema = z.object({});

export const createSupervisorSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, { message: 'Nombre completo requerido' }).max(150),
    email: z.string().email({ message: 'Email inválido' }).max(150),
    phone: z.string().max(30).optional(),
  }),
});

export const updateSupervisorStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de supervisor inválido' }),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const listDriversSchema = z.object({});

export const createDriverSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, { message: 'Nombre completo requerido' }).max(150),
    email: z.string().email({ message: 'Email inválido' }).max(150),
    phone: z.string().max(30).optional(),
  }),
});

export const updateDriverSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de conductor inválido' }),
  }),
  body: z.object({
    fullName: z.string().min(1, { message: 'Nombre completo requerido' }).max(150).optional(),
    email: z.string().email({ message: 'Email inválido' }).max(150).optional(),
    phone: z.string().max(30).optional(),
  }),
});

export const updateDriverStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de conductor inválido' }),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const updateDriverAvailabilitySchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de conductor inválido' }),
  }),
  body: z.object({
    status: z.enum(['available', 'on_route', 'unavailable']),
  }),
});