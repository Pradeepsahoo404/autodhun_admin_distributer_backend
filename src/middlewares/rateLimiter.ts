import rateLimit from 'express-rate-limit';
import { env, isDevelopment } from '@/config/env';

/**
 * In development we skip rate limiting so repeated login/register testing
 * does not block the flow. Production keeps the configured caps.
 */
const devSkip = (): boolean => isDevelopment;

/** Global limiter applied to the whole API surface. */
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: devSkip,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

/** Stricter limiter for authentication endpoints to throttle brute-force/abuse. */
export const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: devSkip,
  message: { success: false, message: 'Too many authentication attempts, please slow down.' },
});
