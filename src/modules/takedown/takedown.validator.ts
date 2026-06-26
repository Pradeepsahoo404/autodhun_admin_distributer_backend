import { z } from 'zod';
import { TAKEDOWN_STATUS } from './takedown.model';

const labelField = z
  .string()
  .trim()
  .min(1, 'Label name is required')
  .max(200, 'Label name must be at most 200 characters');

const songLinkField = z
  .string()
  .trim()
  .url('Enter a valid song link')
  .max(500);

export const createTakedownSchema = z.object({
  labelName: labelField,
  isrcCode: z
    .string()
    .trim()
    .min(1, 'ISRC code is required')
    .max(20, 'ISRC code must be at most 20 characters')
    .transform((v) => v.toUpperCase()),
  songLink: songLinkField,
});

export const updateTakedownSchema = z.object({
  labelName: labelField.optional(),
  isrcCode: z
    .string()
    .trim()
    .min(1, 'ISRC code is required')
    .max(20, 'ISRC code must be at most 20 characters')
    .transform((v) => v.toUpperCase())
    .optional(),
  songLink: songLinkField.optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum([TAKEDOWN_STATUS.ACTIVE, TAKEDOWN_STATUS.INACTIVE]),
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
    .enum([TAKEDOWN_STATUS.ACTIVE, TAKEDOWN_STATUS.INACTIVE, TAKEDOWN_STATUS.IN_PROGRESS])
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

export type CreateTakedownDto = z.infer<typeof createTakedownSchema>;
export type UpdateTakedownDto = z.infer<typeof updateTakedownSchema>;
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
export type ListQueryDto = z.infer<typeof listQuerySchema>;
export type ExportQueryDto = z.infer<typeof exportQuerySchema>;
