import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env, isDevelopment } from '@/config/env';
import { httpLogger } from '@/config/logger';
import { globalRateLimiter } from '@/middlewares/rateLimiter';
import { errorHandler, notFoundHandler } from '@/middlewares/error.middleware';
import { apiRouter } from '@/routes';

function resolveCorsOrigins(): string[] {
  const extras = env.CLIENT_URLS.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const origins = new Set<string>([env.CLIENT_URL, ...extras]);

  // Next.js often falls back to 3001 when 3000 is already taken.
  if (isDevelopment) {
    origins.add('http://localhost:3000');
    origins.add('http://localhost:3001');
    origins.add('http://127.0.0.1:3000');
    origins.add('http://127.0.0.1:3001');
  }

  return [...origins];
}

/**
 * Builds the Express application with the security/observability middleware
 * stack applied in a deliberate order: security headers -> CORS -> body parsing
 * -> compression -> logging -> rate limiting -> routes -> 404 -> error handler.
 */
export const createApp = (): Application => {
  const app = express();
  const allowedOrigins = resolveCorsOrigins();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser / same-origin tools (no Origin header).
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(compression());
  app.use(httpLogger);
  app.use(globalRateLimiter);

  app.use(env.API_PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
