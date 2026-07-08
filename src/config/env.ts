import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

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

  RESEND_API_KEY: z.string().optional().default(''),
  /** Full sender, e.g. `Autodhun <help@autodhun.com>`. Falls back to MAIL_FROM_NAME + MAIL_FROM_EMAIL. */
  MAIL_FROM: z.string().optional().default(''),
  MAIL_FROM_NAME: z.string().default('Autodhun Admin'),
  MAIL_FROM_EMAIL: z.string().default('help@autodhun.com'),

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

  /** Server-level kill switch for the scheduled auto-delete cron. */
  CRON_AUTO_DELETE_ENABLED: z
    .string()
    .optional()
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  /** Cron expression — default: daily at 2:00 AM. */
  CRON_AUTO_DELETE_SCHEDULE: z.string().default('0 2 * * *'),
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
