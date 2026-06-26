import { RequestHandler } from 'express';
import { AnyZodObject, ZodEffects } from 'zod';

type Schema = AnyZodObject | ZodEffects<AnyZodObject>;

/**
 * DTO validation middleware. Parses and replaces `body`, `query` and `params`
 * with their validated/coerced values so controllers receive clean, typed input.
 */
export const validate =
  (schemas: { body?: Schema; query?: Schema; params?: Schema }): RequestHandler =>
  (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
      if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params));
      next();
    } catch (error) {
      next(error);
    }
  };
