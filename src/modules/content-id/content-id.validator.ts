import { z } from 'zod';
import { CONTENT_ID_STATUS } from './content-id.model';

const labelField = z
  .string()
  .trim()
  .min(1, 'Label name is required')
  .max(200, 'Label name must be at most 200 characters');

export const createContentIdSchema = z.object({
  labelName: labelField,
  isrcCode: z
    .string()
    .trim()
    .min(1, 'ISRC is required')
    .max(20, 'ISRC must be at most 20 characters')
    .transform((v) => v.toUpperCase()),
});

export const updateContentIdSchema = z.object({
  labelName: labelField.optional(),
  isrcCode: z
    .string()
    .trim()
    .min(1, 'ISRC is required')
    .max(20, 'ISRC must be at most 20 characters')
    .transform((v) => v.toUpperCase())
    .optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum([CONTENT_ID_STATUS.ACTIVE, CONTENT_ID_STATUS.INACTIVE]),
});

const apiDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .optional();

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z
    .enum([
      CONTENT_ID_STATUS.ACTIVE,
      CONTENT_ID_STATUS.INACTIVE,
      CONTENT_ID_STATUS.IN_PROGRESS,
    ])
    .optional(),
  dateFrom: apiDateField,
  dateTo: apiDateField,
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const exportQuerySchema = z.object({
  dateFrom: apiDateField,
  dateTo: apiDateField,
});

export type CreateContentIdDto = z.infer<typeof createContentIdSchema>;
export type UpdateContentIdDto = z.infer<typeof updateContentIdSchema>;
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
export type ListQueryDto = z.infer<typeof listQuerySchema>;
export type ExportQueryDto = z.infer<typeof exportQuerySchema>;
