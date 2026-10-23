const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'NEO4J_URI',
  'NEO4J_USER',
  'NEO4J_PASSWORD',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'RESEND_API_KEY',
  'WOMPI_PUBLIC_KEY',
  'WOMPI_PRIVATE_KEY',
  'WOMPI_EVENTS_SECRET',
  'WOMPI_INTEGRITY_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const;

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.warn(`Missing env var: ${key}`);
  }
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  REDIS_URL: process.env.REDIS_URL!,
  NEO4J_URI: process.env.NEO4J_URI!,
  NEO4J_USER: process.env.NEO4J_USER!,
  NEO4J_PASSWORD: process.env.NEO4J_PASSWORD!,
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
  RESEND_API_KEY: process.env.RESEND_API_KEY!,
  WOMPI_PUBLIC_KEY: process.env.WOMPI_PUBLIC_KEY!,
  WOMPI_PRIVATE_KEY: process.env.WOMPI_PRIVATE_KEY!,
  WOMPI_EVENTS_SECRET: process.env.WOMPI_EVENTS_SECRET!,
  WOMPI_INTEGRITY_SECRET: process.env.WOMPI_INTEGRITY_SECRET!,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME!,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY!,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET!,
  PORT: parseInt(process.env.PORT ?? '3000', 10),
  WEB_APP_URL: process.env.WEB_APP_URL ?? 'http://localhost:5173',
} as const;

export type Env = typeof env;