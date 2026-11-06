import { z } from 'zod';

const pagination = {
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
};

export const listBillingHistorySchema = z.object({
  query: z.object(pagination),
});

export const subscribeSchema = z.object({
  body: z.object({
    planId: z.string().uuid({ message: 'ID de plan inválido' }),
    billingCycle: z.enum(['monthly', 'annual']),
  }),
});

export const purchaseCreditsSchema = z.object({
  body: z.object({
    packageId: z.string().uuid({ message: 'ID de paquete inválido' }),
  }),
});

export const purchaseModuleSchema = z.object({
  body: z.object({
    moduleId: z.string().uuid({ message: 'ID de módulo inválido' }),
  }),
});

export const updateSpendingLimitSchema = z.object({
  body: z.object({
    limit: z.coerce.number().nonnegative().max(9_999_999_999).nullable(),
  }),
});

export const registerCardSchema = z.object({
  body: z.object({
    token: z.string().min(1, { message: 'Token de tarjeta requerido' }),
  }),
});
