import { body, param, ValidationChain } from 'express-validator';

export const loginValidation: ValidationChain[] = [
  body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
  body('password').notEmpty().withMessage('Contraseña requerida'),
];

export const refreshValidation: ValidationChain[] = [
  body('refreshToken').notEmpty().withMessage('Refresh token requerido'),
];

export const acceptInvitationValidation: ValidationChain[] = [
  body('token').notEmpty().withMessage('Token de invitación requerido'),
  body('password')
    .isLength({ min: 10 })
    .withMessage('La contraseña debe tener al menos 10 caracteres'),
];

export const logoutValidation: ValidationChain[] = [
  body('refreshToken').optional().isString(),
];

export const resendInvitationValidation: ValidationChain[] = [
  param('userId').isUUID().withMessage('ID de usuario inválido'),
];