import { z } from 'zod';

const businessDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha inválida' })
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, { message: 'Fecha inválida' });

export const reportSummarySchema = z
  .object({
    query: z.object({
      from: businessDate.optional(),
      to: businessDate.optional(),
      branchId: z.string().uuid({ message: 'ID de sede inválido' }).optional(),
    }),
  })
  .refine(
    (value) =>
      !value.query.from || !value.query.to || value.query.from <= value.query.to,
    { message: 'La fecha inicial no puede ser posterior a la final', path: ['query', 'from'] }
  );

export type ReportSummaryInput = z.infer<typeof reportSummarySchema>['query'];
