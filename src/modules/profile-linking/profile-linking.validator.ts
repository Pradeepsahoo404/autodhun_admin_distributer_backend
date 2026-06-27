import { z } from 'zod';
import { PROFILE_LINKING_STATUS } from './profile-linking.model';
import {
  facebookPageLinkField,
  instagramHandleField,
  isrcField,
  textField,
} from '@/validators/field.validator';

export const createProfileLinkingSchema = z.object({
  labelName: textField('Label name'),
  isrcCode: isrcField,
  facebookPageLink: facebookPageLinkField,
  instagramHandleName: instagramHandleField,
});

export const updateProfileLinkingSchema = z.object({
  labelName: textField('Label name').optional(),
  isrcCode: isrcField.optional(),
  facebookPageLink: facebookPageLinkField.optional(),
  instagramHandleName: instagramHandleField.optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum([PROFILE_LINKING_STATUS.ACTIVE, PROFILE_LINKING_STATUS.INACTIVE]),
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
      PROFILE_LINKING_STATUS.ACTIVE,
      PROFILE_LINKING_STATUS.INACTIVE,
      PROFILE_LINKING_STATUS.IN_PROGRESS,
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

export type CreateProfileLinkingDto = z.infer<typeof createProfileLinkingSchema>;
export type UpdateProfileLinkingDto = z.infer<typeof updateProfileLinkingSchema>;
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
export type ListQueryDto = z.infer<typeof listQuerySchema>;
export type ExportQueryDto = z.infer<typeof exportQuerySchema>;
