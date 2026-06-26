import { z } from 'zod';
import { OAC_STATUS } from './oac.model';

const nameField = z
  .string()
  .trim()
  .min(1, 'Artist channel name is required')
  .max(200, 'Artist channel name must be at most 200 characters');

const linkField = (label: string) =>
  z
    .string()
    .trim()
    .url(`Enter a valid ${label}`)
    .max(500);

export const createOacSchema = z.object({
  artistChannelName: nameField,
  artistChannelLink: linkField('artist channel link'),
  artistChannelTopicLink: linkField('artist channel topic link'),
  isrcCode: z
    .string()
    .trim()
    .min(1, 'ISRC code is required')
    .max(20, 'ISRC code must be at most 20 characters')
    .transform((v) => v.toUpperCase()),
});

export const updateOacSchema = z.object({
  artistChannelName: nameField.optional(),
  artistChannelLink: linkField('artist channel link').optional(),
  artistChannelTopicLink: linkField('artist channel topic link').optional(),
  isrcCode: z
    .string()
    .trim()
    .min(1, 'ISRC code is required')
    .max(20, 'ISRC code must be at most 20 characters')
    .transform((v) => v.toUpperCase())
    .optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum([OAC_STATUS.ACTIVE, OAC_STATUS.INACTIVE]),
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
    .enum([OAC_STATUS.ACTIVE, OAC_STATUS.INACTIVE, OAC_STATUS.IN_PROGRESS])
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

export type CreateOacDto = z.infer<typeof createOacSchema>;
export type UpdateOacDto = z.infer<typeof updateOacSchema>;
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
export type ListQueryDto = z.infer<typeof listQuerySchema>;
export type ExportQueryDto = z.infer<typeof exportQuerySchema>;
