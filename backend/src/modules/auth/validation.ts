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
    password: z
      .string()
      .min(10, { message: 'La contraseña debe tener al menos 10 caracteres' }),
  }),
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshInput = z.infer<typeof refreshSchema>['body'];
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>['body'];
export type LogoutInput = z.infer<typeof logoutSchema>['body'];