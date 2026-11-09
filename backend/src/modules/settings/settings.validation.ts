import { z } from 'zod';
import { SETTING_DEFINITIONS } from './settings.service.js';

const boundedSetting = (key: keyof typeof SETTING_DEFINITIONS) =>
  z
    .number()
    .int({ message: `${SETTING_DEFINITIONS[key].label} debe ser un número entero` })
    .min(SETTING_DEFINITIONS[key].min, {
      message: `${SETTING_DEFINITIONS[key].label} debe ser mayor o igual a ${SETTING_DEFINITIONS[key].min}`,
    })
    .max(SETTING_DEFINITIONS[key].max, {
      message: `${SETTING_DEFINITIONS[key].label} debe ser menor o igual a ${SETTING_DEFINITIONS[key].max}`,
    })
    .optional();

export const updateSystemSettingsSchema = z.object({
  body: z
    .object({
      invitation_expiry_hours: boundedSetting('invitation_expiry_hours'),
      refresh_token_days: boundedSetting('refresh_token_days'),
      access_token_minutes: boundedSetting('access_token_minutes'),
      password_min_length: boundedSetting('password_min_length'),
      bcrypt_rounds: boundedSetting('bcrypt_rounds'),
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'Debes enviar al menos un valor para actualizar',
    }),
});

export type UpdateSystemSettingsInput = z.infer<
  typeof updateSystemSettingsSchema
>['body'];
