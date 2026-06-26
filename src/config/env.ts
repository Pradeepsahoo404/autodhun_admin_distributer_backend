import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/** Parses env booleans correctly — `z.coerce.boolean()` treats the string "false" as true. */
const envBoolean = z
  .union([z.boolean(), z.string(), z.number()])
  .transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    const normalized = val.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  });

/**
 * Strongly-typed, validated environment configuration.
 * The process will fail fast on boot if any required variable is missing or malformed,
 * which prevents misconfigured deployments from ever serving traffic.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_PREFIX: z.string().default('/api'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  CLIENT_URL: z.string().url().default('http://localhost:3000'),

  JWT_ACCESS_SECRET: z.string().min(10, 'JWT_ACCESS_SECRET is too short'),
  JWT_REFRESH_SECRET: z.string().min(10, 'JWT_REFRESH_SECRET is too short'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  OTP_LENGTH: z.coerce.number().min(4).max(8).default(6),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(10),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(40),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: envBoolean.default(false),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM_NAME: z.string().default('Autodhun Admin'),
  MAIL_FROM_EMAIL: z.string().default('no-reply@autodhun.com'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(20),

  SUPER_ADMIN_EMAIL: z.string().email().default('superadmin@autodhun.com'),
  SUPER_ADMIN_PASSWORD: z.string().default('Super@123'),
  ADMIN_EMAIL: z.string().email().default('sahoopradeep034@gmail.com'),
  ADMIN_PASSWORD: z.string().default('Admin@123'),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
