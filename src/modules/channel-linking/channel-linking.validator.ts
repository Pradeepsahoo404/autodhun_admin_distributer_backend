import { z } from 'zod';
import { CHANNEL_LINKING_STATUS } from './channel-linking.model';
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

const revenueField = z.coerce
  .number({ invalid_type_error: 'Total revenue must be a number' })
  .min(0, 'Total revenue cannot be negative');

const viewsField = z.coerce
  .number({ invalid_type_error: 'Total views must be a number' })
  .int('Total views must be a whole number')
  .min(0, 'Total views cannot be negative');

export const createChannelLinkingSchema = z.object({
  channelLink: urlField('Channel link'),
  channelName: channelNameField,
  totalRevenue90Days: revenueField,
  totalViews90Days: viewsField,
});

export const updateChannelLinkingSchema = z.object({
  channelLink: urlField('Channel link').optional(),
  channelName: channelNameField.optional(),
  totalRevenue90Days: revenueField.optional(),
  totalViews90Days: viewsField.optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum([
    CHANNEL_LINKING_STATUS.APPROVED,
    CHANNEL_LINKING_STATUS.REJECTED,
    CHANNEL_LINKING_STATUS.IN_PROCESS,
  ]),
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
      CHANNEL_LINKING_STATUS.IN_PROCESS,
      CHANNEL_LINKING_STATUS.APPROVED,
      CHANNEL_LINKING_STATUS.REJECTED,
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

export type CreateChannelLinkingDto = z.infer<typeof createChannelLinkingSchema>;
export type UpdateChannelLinkingDto = z.infer<typeof updateChannelLinkingSchema>;
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
export type ListQueryDto = z.infer<typeof listQuerySchema>;
export type ExportQueryDto = z.infer<typeof exportQuerySchema>;
