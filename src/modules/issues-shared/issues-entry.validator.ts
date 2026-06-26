import { z } from 'zod';
import {
  ISSUES_ENTRY_ASSET_TYPES,
  ISSUES_ENTRY_OWNERSHIP,
  ISSUES_ENTRY_STATUS,
} from './issues-entry.constants';
import { objectId } from '@/validators/common.validator';

const textField = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be at most ${max} characters`);

const isrcField = z
  .string()
  .trim()
  .min(1, 'ISRC is required')
  .max(20, 'ISRC must be at most 20 characters')
  .transform((v) => v.toUpperCase());

export const createIssuesEntrySchema = z.object({
  otherParty: textField('Other party'),
  assetName: textField('Asset name'),
  assetType: z.enum(ISSUES_ENTRY_ASSET_TYPES, { message: 'Select a valid asset type' }),
  isrcCode: isrcField,
  overlappingAssetName: textField('Overlapping asset name'),
  labelName: textField('Label'),
  assignedTo: objectId,
});

export const updateIssuesEntrySchema = z.object({
  otherParty: textField('Other party').optional(),
  assetName: textField('Asset name').optional(),
  assetType: z.enum(ISSUES_ENTRY_ASSET_TYPES).optional(),
  isrcCode: isrcField.optional(),
  overlappingAssetName: textField('Overlapping asset name').optional(),
  labelName: textField('Label').optional(),
  assignedTo: objectId.optional(),
});

export const updateIssuesEntryStatusSchema = z.object({
  status: z.enum([ISSUES_ENTRY_STATUS.ACTIVE, ISSUES_ENTRY_STATUS.INACTIVE]),
});

export const updateIssuesEntryOwnershipSchema = z.object({
  ownership: z.enum([ISSUES_ENTRY_OWNERSHIP.YES, ISSUES_ENTRY_OWNERSHIP.NO], {
    message: 'Ownership must be yes or no',
  }),
});

const apiDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .optional();

export const issuesEntryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum([ISSUES_ENTRY_STATUS.ACTIVE, ISSUES_ENTRY_STATUS.INACTIVE]).optional(),
  ownership: z
    .enum(['', ISSUES_ENTRY_OWNERSHIP.YES, ISSUES_ENTRY_OWNERSHIP.NO, 'pending'])
    .optional()
    .transform((v) => (v === 'pending' ? '' : v)),
  dateFrom: apiDateField,
  dateTo: apiDateField,
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const issuesEntryExportQuerySchema = z.object({
  dateFrom: apiDateField,
  dateTo: apiDateField,
});

export type CreateIssuesEntryDto = z.infer<typeof createIssuesEntrySchema>;
export type UpdateIssuesEntryDto = z.infer<typeof updateIssuesEntrySchema>;
export type UpdateIssuesEntryStatusDto = z.infer<typeof updateIssuesEntryStatusSchema>;
export type UpdateIssuesEntryOwnershipDto = z.infer<typeof updateIssuesEntryOwnershipSchema>;
export type IssuesEntryListQueryDto = z.infer<typeof issuesEntryListQuerySchema>;
export type IssuesEntryExportQueryDto = z.infer<typeof issuesEntryExportQuerySchema>;
