import { z } from 'zod';
import { PROFILE_LINKING_STATUS } from './profile-linking.model';

const labelField = z
  .string()
  .trim()
  .min(1, 'Label name is required')
  .max(200, 'Label name must be at most 200 characters');

const facebookPageLinkField = z
  .string()
  .trim()
  .url('Enter a valid Facebook page link')
  .max(500)
  .refine((url) => /facebook\.com|fb\.com/i.test(url), 'Enter a valid Facebook page link');

const instagramHandleField = z
  .string()
  .trim()
  .min(1, 'Instagram handle name is required')
  .max(100, 'Instagram handle name must be at most 100 characters');

export const createProfileLinkingSchema = z.object({
  labelName: labelField,
  isrcCode: z
    .string()
    .trim()
    .min(1, 'ISRC code is required')
    .max(20, 'ISRC code must be at most 20 characters')
    .transform((v) => v.toUpperCase()),
  facebookPageLink: facebookPageLinkField,
  instagramHandleName: instagramHandleField,
});

export const updateProfileLinkingSchema = z.object({
  labelName: labelField.optional(),
  isrcCode: z
    .string()
    .trim()
    .min(1, 'ISRC code is required')
    .max(20, 'ISRC code must be at most 20 characters')
    .transform((v) => v.toUpperCase())
    .optional(),
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
