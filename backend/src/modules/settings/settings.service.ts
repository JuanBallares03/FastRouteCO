import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export const SETTING_DEFINITIONS = {
  invitation_expiry_hours: {
    label: 'Vigencia de invitaciones',
    description: 'Horas durante las cuales un enlace de invitación es válido.',
    min: 1,
    max: 168,
  },
  refresh_token_days: {
    label: 'Vigencia del refresh token',
    description: 'Días durante los cuales se puede renovar la sesión.',
    min: 1,
    max: 30,
  },
  access_token_minutes: {
    label: 'Vigencia del access token',
    description: 'Minutos durante los cuales un token de acceso es válido.',
    min: 5,
    max: 60,
  },
  password_min_length: {
    label: 'Longitud mínima de contraseña',
    description: 'Cantidad mínima de caracteres aceptada para una contraseña.',
    min: 10,
    max: 64,
  },
  bcrypt_rounds: {
    label: 'Rondas de bcrypt',
    description: 'Costo de hash para contraseñas nuevas. Las contraseñas existentes no cambian.',
    min: 10,
    max: 14,
  },
} as const;

export type SettingKey = keyof typeof SETTING_DEFINITIONS;
export type RuntimeSettings = Record<SettingKey, number>;

export const DEFAULT_SETTINGS: RuntimeSettings = {
  invitation_expiry_hours: 72,
  refresh_token_days: 7,
  access_token_minutes: 15,
  password_min_length: 10,
  bcrypt_rounds: 12,
};

const SETTING_KEYS = Object.keys(SETTING_DEFINITIONS) as SettingKey[];

let cache: RuntimeSettings | null = null;
let pendingLoad: Promise<RuntimeSettings> | null = null;

function numberFromJson(value: Prisma.JsonValue): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clampSetting(key: SettingKey, value: number): number {
  const definition = SETTING_DEFINITIONS[key];
  return Math.min(definition.max, Math.max(definition.min, Math.trunc(value)));
}

async function loadSettings(): Promise<RuntimeSettings> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: SETTING_KEYS } },
  });

  const values: RuntimeSettings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (!(row.key in SETTING_DEFINITIONS)) continue;
    const key = row.key as SettingKey;
    const parsed = numberFromJson(row.value);
    if (parsed !== null) {
      values[key] = clampSetting(key, parsed);
    }
  }

  return values;
}

export async function getRuntimeSettings(): Promise<RuntimeSettings> {
  if (cache) return cache;
  if (!pendingLoad) {
    pendingLoad = loadSettings()
      .then((settings) => {
        cache = settings;
        return settings;
      })
      .finally(() => {
        pendingLoad = null;
      });
  }
  return pendingLoad;
}

export function invalidateSettingsCache(): void {
  cache = null;
}

export async function listSystemSettings() {
  const values = await getRuntimeSettings();
  return SETTING_KEYS.map((key) => ({
    key,
    value: values[key],
    ...SETTING_DEFINITIONS[key],
  }));
}

export async function updateSystemSettings(data: Partial<Record<SettingKey, number>>) {
  const entries = Object.entries(data).filter(
    (entry): entry is [SettingKey, number] =>
      SETTING_KEYS.includes(entry[0] as SettingKey) && typeof entry[1] === 'number'
  );

  if (entries.length === 0) {
    return listSystemSettings();
  }

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value: value as Prisma.InputJsonValue },
        create: { key, value: value as Prisma.InputJsonValue },
      })
    )
  );

  invalidateSettingsCache();
  return listSystemSettings();
}
