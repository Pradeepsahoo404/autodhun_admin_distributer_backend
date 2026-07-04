import { z } from 'zod';
import { CONTENT_ID_STATUS } from './content-id.model';
import { isrcField, catalogLabelField } from '@/validators/field.validator';

export const createContentIdSchema = z.object({
  labelName: catalogLabelField('Label name'),
  isrcCode: isrcField,
});

export const updateContentIdSchema = z.object({
  labelName: catalogLabelField('Label name').optional(),
  isrcCode: isrcField.optional(),
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
