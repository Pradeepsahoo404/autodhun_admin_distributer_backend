import { z } from 'zod';
import { Types } from 'mongoose';

export const objectId = z
  .string()
  .refine((val) => Types.ObjectId.isValid(val), { message: 'Invalid id format' });

export const idParamSchema = z.object({ id: objectId });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(['active', 'inactive', 'blocked']).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  tenantId: objectId.optional(),
});

export type PaginationQueryDto = z.infer<typeof paginationQuerySchema>;
