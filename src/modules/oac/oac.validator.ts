import { z } from 'zod';
import { OAC_STATUS } from './oac.model';
import { isrcField, textField, youtubeUrlField } from '@/validators/field.validator';

export const createOacSchema = z.object({
  artistChannelName: textField('Artist channel name'),
  artistChannelLink: youtubeUrlField('Artist channel link'),
  artistChannelTopicLink: youtubeUrlField('Artist channel topic link'),
  isrcCode: isrcField,
});

export const updateOacSchema = z.object({
  artistChannelName: textField('Artist channel name').optional(),
  artistChannelLink: youtubeUrlField('Artist channel link').optional(),
  artistChannelTopicLink: youtubeUrlField('Artist channel topic link').optional(),
  isrcCode: isrcField.optional(),
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
