import { z } from 'zod';

export const createCompanySchema = z.object({
  body: z.object({
    legalName: z.string().min(1, { message: 'Razón social requerida' }).max(200),
    taxId: z.string().min(1, { message: 'NIT requerido' }).max(20),
    email: z.string().email({ message: 'Email inválido' }).max(150),
    phone: z.string().max(30).optional(),
    address: z.string().max(255).optional(),
    hasOwnFleet: z.boolean(),
  }),
});

export const updateCompanyStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de empresa inválido' }),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const listCompaniesSchema = z.object({
  query: z.object({
    companyStatus: z.enum(['active', 'inactive']).optional(),
    subscriptionStatus: z.enum(['active', 'inactive', 'expired']).optional(),
    planId: z.string().uuid().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export const getCompanySchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de empresa inválido' }),
  }),
});

export const createCompanyAdminSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de empresa inválido' }),
  }),
  body: z.object({
    fullName: z.string().min(1, { message: 'Nombre completo requerido' }).max(150),
    email: z.string().email({ message: 'Email inválido' }).max(150),
    phone: z.string().max(30).optional(),
  }),
});

export const updateCompanyAdminStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de empresa inválido' }),
    adminId: z.string().uuid({ message: 'ID de administrador inválido' }),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const listCompanyAdminsSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'ID de empresa inválido' }),
  }),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>['body'];
export type UpdateCompanyStatusInput = z.infer<typeof updateCompanyStatusSchema>['body'];
export type ListCompaniesInput = z.infer<typeof listCompaniesSchema>['query'];
export type CreateCompanyAdminInput = z.infer<typeof createCompanyAdminSchema>['body'];
export type UpdateCompanyAdminStatusInput = z.infer<typeof updateCompanyAdminStatusSchema>['body'];