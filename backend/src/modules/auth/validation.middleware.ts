import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email({ message: 'Email inválido' }),
    password: z.string().min(1, { message: 'Contraseña requerida' }),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, { message: 'Refresh token requerido' }),
  }),
});

export const acceptInvitationSchema = z.object({
  body: z.object({
    token: z.string().min(1, { message: 'Token de invitación requerido' }),
    password: z.string().min(10, { message: 'La contraseña debe tener al menos 10 caracteres' }),
  }),
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
});

export const resendInvitationSchema = z.object({
  params: z.object({
    userId: z.string().uuid({ message: 'ID de usuario inválido' }),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshInput = z.infer<typeof refreshSchema>['body'];
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>['body'];
export type LogoutInput = z.infer<typeof logoutSchema>['body'];

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      const messages: { field: string; message: string }[] = [];
      for (const [field, msgs] of Object.entries(errors)) {
        if (Array.isArray(msgs)) {
          for (const msg of msgs) {
            messages.push({ field, message: msg });
          }
        }
      }
      res.status(400).json({ errors: messages });
      return;
    }
    next();
  };
}