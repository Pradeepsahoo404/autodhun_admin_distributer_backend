import { z } from 'zod';
import { MANUAL_CLAIMING_STATUS } from './manual-claiming.model';

const labelField = z
  .string()
  .trim()
  .min(1, 'Label name is required')
  .max(200, 'Label name must be at most 200 characters');

const linkField = (label: string) =>
  z
    .string()
    .trim()
    .url(`Enter a valid ${label}`)
    .max(500);

export const createManualClaimingSchema = z.object({
  labelName: labelField,
  originalSongLink: linkField('original song link'),
  isrcCode: z
    .string()
    .trim()
    .min(1, 'ISRC code is required')
    .max(20, 'ISRC code must be at most 20 characters')
    .transform((v) => v.toUpperCase()),
  songLink: linkField('song link'),
});

export const updateManualClaimingSchema = z.object({
  labelName: labelField.optional(),
  originalSongLink: linkField('original song link').optional(),
  isrcCode: z
    .string()
    .trim()
    .min(1, 'ISRC code is required')
    .max(20, 'ISRC code must be at most 20 characters')
    .transform((v) => v.toUpperCase())
    .optional(),
  songLink: linkField('song link').optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum([MANUAL_CLAIMING_STATUS.ACTIVE, MANUAL_CLAIMING_STATUS.INACTIVE]),
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
      MANUAL_CLAIMING_STATUS.ACTIVE,
      MANUAL_CLAIMING_STATUS.INACTIVE,
      MANUAL_CLAIMING_STATUS.IN_PROGRESS,
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

export type CreateManualClaimingDto = z.infer<typeof createManualClaimingSchema>;
export type UpdateManualClaimingDto = z.infer<typeof updateManualClaimingSchema>;
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
export type ListQueryDto = z.infer<typeof listQuerySchema>;
export type ExportQueryDto = z.infer<typeof exportQuerySchema>;
