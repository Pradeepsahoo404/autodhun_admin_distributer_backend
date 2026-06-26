import { z } from 'zod';
import {
  REFERENCE_OVERLAP_ASSET_TYPES,
  REFERENCE_OVERLAP_OWNERSHIP,
  REFERENCE_OVERLAP_STATUS,
} from './reference-overlaps.model';
import { objectId } from '@/validators/common.validator';

const textField = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be at most ${max} characters`);

const isrcField = z
  .string()
  .trim()
  .min(1, 'ISRC is required')
  .max(20, 'ISRC must be at most 20 characters')
  .transform((v) => v.toUpperCase());

export const createReferenceOverlapSchema = z.object({
  otherParty: textField('Other party'),
  assetName: textField('Asset name'),
  assetType: z.enum(REFERENCE_OVERLAP_ASSET_TYPES, { message: 'Select a valid asset type' }),
  isrcCode: isrcField,
  overlappingAssetName: textField('Overlapping asset name'),
  labelName: textField('Label'),
  assignedTo: objectId,
});

export const updateReferenceOverlapSchema = z.object({
  otherParty: textField('Other party').optional(),
  assetName: textField('Asset name').optional(),
  assetType: z.enum(REFERENCE_OVERLAP_ASSET_TYPES).optional(),
  isrcCode: isrcField.optional(),
  overlappingAssetName: textField('Overlapping asset name').optional(),
  labelName: textField('Label').optional(),
  assignedTo: objectId.optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum([REFERENCE_OVERLAP_STATUS.ACTIVE, REFERENCE_OVERLAP_STATUS.INACTIVE]),
});

export const updateOwnershipSchema = z.object({
  ownership: z.enum([REFERENCE_OVERLAP_OWNERSHIP.YES, REFERENCE_OVERLAP_OWNERSHIP.NO], {
    message: 'Ownership must be yes or no',
  }),
});

const apiDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .optional();

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum([REFERENCE_OVERLAP_STATUS.ACTIVE, REFERENCE_OVERLAP_STATUS.INACTIVE]).optional(),
  ownership: z
    .enum(['', REFERENCE_OVERLAP_OWNERSHIP.YES, REFERENCE_OVERLAP_OWNERSHIP.NO, 'pending'])
    .optional()
    .transform((v) => (v === 'pending' ? '' : v)),
  dateFrom: apiDateField,
  dateTo: apiDateField,
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const exportQuerySchema = z.object({
  dateFrom: apiDateField,
  dateTo: apiDateField,
});

export type CreateReferenceOverlapDto = z.infer<typeof createReferenceOverlapSchema>;
export type UpdateReferenceOverlapDto = z.infer<typeof updateReferenceOverlapSchema>;
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
export type UpdateOwnershipDto = z.infer<typeof updateOwnershipSchema>;
export type ListQueryDto = z.infer<typeof listQuerySchema>;
export type ExportQueryDto = z.infer<typeof exportQuerySchema>;
