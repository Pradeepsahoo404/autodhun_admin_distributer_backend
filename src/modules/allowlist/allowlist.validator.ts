import { z } from 'zod';
import { ALLOWLIST_STATUS } from './allowlist.model';
import { textField, urlField } from '@/validators/field.validator';

export const createAllowlistSchema = z.object({
  labelName: textField('Label name'),
  channelLink: urlField('Channel link'),
});

export const updateAllowlistSchema = z.object({
  labelName: textField('Label name').optional(),
  channelLink: urlField('Channel link').optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum([ALLOWLIST_STATUS.ACTIVE, ALLOWLIST_STATUS.INACTIVE]),
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
    .enum([ALLOWLIST_STATUS.ACTIVE, ALLOWLIST_STATUS.INACTIVE, ALLOWLIST_STATUS.IN_PROGRESS])
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

export type CreateAllowlistDto = z.infer<typeof createAllowlistSchema>;
export type UpdateAllowlistDto = z.infer<typeof updateAllowlistSchema>;
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
export type ListQueryDto = z.infer<typeof listQuerySchema>;
export type ExportQueryDto = z.infer<typeof exportQuerySchema>;
