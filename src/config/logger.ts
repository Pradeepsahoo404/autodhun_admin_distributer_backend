import morgan from 'morgan';
import { isProduction } from './env';

/**
 * Minimal structured logger. In a larger system this would be swapped for
 * pino/winston, but the public surface (info/warn/error/debug) stays stable
 * so call-sites never change.
 */
const timestamp = (): string => new Date().toISOString();

export const logger = {
  info: (message: string, meta?: unknown): void => {
    // eslint-disable-next-line no-console
    console.log(`[${timestamp()}] [INFO] ${message}`, meta ?? '');
  },
  warn: (message: string, meta?: unknown): void => {
    // eslint-disable-next-line no-console
    console.warn(`[${timestamp()}] [WARN] ${message}`, meta ?? '');
  },
  error: (message: string, meta?: unknown): void => {
    // eslint-disable-next-line no-console
    console.error(`[${timestamp()}] [ERROR] ${message}`, meta ?? '');
  },
  debug: (message: string, meta?: unknown): void => {
    if (!isProduction) {
      // eslint-disable-next-line no-console
      console.debug(`[${timestamp()}] [DEBUG] ${message}`, meta ?? '');
    }
  },
};

/** HTTP request logger middleware (concise in prod, verbose in dev). */
export const httpLogger = morgan(isProduction ? 'combined' : 'dev');
