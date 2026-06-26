import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from '@/config/env';
import { httpLogger } from '@/config/logger';
import { globalRateLimiter } from '@/middlewares/rateLimiter';
import { errorHandler, notFoundHandler } from '@/middlewares/error.middleware';
import { apiRouter } from '@/routes';

/**
 * Builds the Express application with the security/observability middleware
 * stack applied in a deliberate order: security headers -> CORS -> body parsing
 * -> compression -> logging -> rate limiting -> routes -> 404 -> error handler.
 */
export const createApp = (): Application => {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
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
