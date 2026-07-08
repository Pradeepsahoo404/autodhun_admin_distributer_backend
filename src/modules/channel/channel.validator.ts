import { z } from 'zod';
import { CHANNEL_STATUS } from './channel.model';
import { urlField } from '@/validators/field.validator';

const CHANNEL_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\s.,'"&()_@#:!|/-]*$/u;

const channelNameField = z
  .string()
  .trim()
  .min(2, 'Channel name must be at least 2 characters')
  .max(100, 'Channel name must be at most 100 characters')
  .regex(
    CHANNEL_NAME_PATTERN,
    "Channel name must start with a letter or number and can only contain letters, numbers, spaces and . , ' \" & ( ) _ @ # : ! | / -",
  );

export const createChannelSchema = z.object({
  channelName: channelNameField,
  channelLink: urlField('Existing channel link'),
});

export const updateChannelSchema = z.object({
  channelName: channelNameField.optional(),
  channelLink: urlField('Existing channel link').optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum([CHANNEL_STATUS.ACTIVE, CHANNEL_STATUS.INACTIVE]),
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
    .enum([CHANNEL_STATUS.ACTIVE, CHANNEL_STATUS.INACTIVE, CHANNEL_STATUS.IN_PROGRESS])
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

export type CreateChannelDto = z.infer<typeof createChannelSchema>;
export type UpdateChannelDto = z.infer<typeof updateChannelSchema>;
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
export type ListQueryDto = z.infer<typeof listQuerySchema>;
export type ExportQueryDto = z.infer<typeof exportQuerySchema>;
