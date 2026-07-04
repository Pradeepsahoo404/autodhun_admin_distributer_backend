import { z } from 'zod';
import { CLAIM_RELEASE_STATUS } from './facebook-claim-release.model';
import {
  catalogLabelField,
  facebookPageLinkField,
  isrcField,
} from '@/validators/field.validator';

export const LABEL_NAMES_MUST_MATCH_MESSAGE =
  'Sender and receiver label names must always be the same';

const normalizeLabel = (value: string) => value.trim().toLowerCase();

function assertMatchingLabels(sender: string, receiver: string, ctx: z.RefinementCtx): void {
  if (normalizeLabel(sender) !== normalizeLabel(receiver)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: LABEL_NAMES_MUST_MATCH_MESSAGE,
      path: ['senderLabelName'],
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: LABEL_NAMES_MUST_MATCH_MESSAGE,
      path: ['receiverLabelName'],
    });
  }
}

export const createFacebookClaimReleaseSchema = z
  .object({
    senderLabelName: catalogLabelField('Sender label name'),
    receiverLabelName: catalogLabelField('Receiver label name'),
    facebookPageLink: facebookPageLinkField,
    isrcCode: isrcField,
  })
  .superRefine((data, ctx) => {
    assertMatchingLabels(data.senderLabelName, data.receiverLabelName, ctx);
  });

export const updateFacebookClaimReleaseSchema = z
  .object({
    senderLabelName: catalogLabelField('Sender label name').optional(),
    receiverLabelName: catalogLabelField('Receiver label name').optional(),
    facebookPageLink: facebookPageLinkField.optional(),
    isrcCode: isrcField.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.senderLabelName !== undefined && data.receiverLabelName !== undefined) {
      assertMatchingLabels(data.senderLabelName, data.receiverLabelName, ctx);
    }
  });

export const updateStatusSchema = z.object({
  status: z.enum([CLAIM_RELEASE_STATUS.ACTIVE, CLAIM_RELEASE_STATUS.INACTIVE]),
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
      CLAIM_RELEASE_STATUS.ACTIVE,
      CLAIM_RELEASE_STATUS.INACTIVE,
      CLAIM_RELEASE_STATUS.IN_PROGRESS,
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

export type CreateFacebookClaimReleaseDto = z.infer<typeof createFacebookClaimReleaseSchema>;
export type UpdateFacebookClaimReleaseDto = z.infer<typeof updateFacebookClaimReleaseSchema>;
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
export type ListQueryDto = z.infer<typeof listQuerySchema>;
export type ExportQueryDto = z.infer<typeof exportQuerySchema>;
