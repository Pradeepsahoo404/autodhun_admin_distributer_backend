import { NextFunction, Request, Response, RequestHandler } from 'express';

/**
 * Wraps an async controller so rejected promises are forwarded to Express'
 * error pipeline instead of crashing the process or hanging the request.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
