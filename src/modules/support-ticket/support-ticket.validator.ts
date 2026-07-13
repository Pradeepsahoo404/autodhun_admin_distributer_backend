import { z } from 'zod';
import {
  ALL_SUPPORT_TICKET_CATEGORIES,
  ALL_SUPPORT_TICKET_ISSUE_TYPES,
  SUPPORT_TICKET_CASE_FILTER,
  SUPPORT_TICKET_STATUS,
  isValidSupportTicketIssueTypeForCategory,
  type SupportTicketCategory,
  type SupportTicketIssueType,
} from './support-ticket.constants';

const descriptionField = z
  .string()
  .trim()
  .min(10, 'Description must be at least 10 characters')
  .max(5000, 'Description must be at most 5000 characters');

const categoryField = z.enum(ALL_SUPPORT_TICKET_CATEGORIES as [SupportTicketCategory, ...SupportTicketCategory[]]);
const issueTypeField = z.enum(ALL_SUPPORT_TICKET_ISSUE_TYPES as [SupportTicketIssueType, ...SupportTicketIssueType[]]);

const categoryIssueTypeRefine = {
  refine: (data: { category: SupportTicketCategory; issueType: SupportTicketIssueType }) =>
    isValidSupportTicketIssueTypeForCategory(data.category, data.issueType),
  message: 'Issue type does not match the selected category',
  path: ['issueType'] as ['issueType'],
};

export const createSupportTicketSchema = z
  .object({
    category: categoryField,
    issueType: issueTypeField,
    description: descriptionField,
  })
  .refine(categoryIssueTypeRefine.refine, {
    message: categoryIssueTypeRefine.message,
    path: categoryIssueTypeRefine.path,
  });

export const updateSupportTicketSchema = z
  .object({
    category: categoryField.optional(),
    issueType: issueTypeField.optional(),
    description: descriptionField.optional(),
  })
  .refine(
    (data) => {
      if (!data.category || !data.issueType) return true;
      return isValidSupportTicketIssueTypeForCategory(data.category, data.issueType);
    },
    {
      message: categoryIssueTypeRefine.message,
      path: categoryIssueTypeRefine.path,
    },
  );

export const updateSupportTicketStatusSchema = z.object({
  status: z.enum([SUPPORT_TICKET_STATUS.OPEN, SUPPORT_TICKET_STATUS.RESOLVED]),
  resolutionNote: z.string().trim().max(2000).optional(),
});

export const listSupportTicketsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  caseFilter: z
    .enum([
      SUPPORT_TICKET_CASE_FILTER.ALL,
      SUPPORT_TICKET_CASE_FILTER.OPEN,
      SUPPORT_TICKET_CASE_FILTER.RESOLVED,
    ])
    .default(SUPPORT_TICKET_CASE_FILTER.ALL),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateSupportTicketDto = z.infer<typeof createSupportTicketSchema>;
export type UpdateSupportTicketDto = z.infer<typeof updateSupportTicketSchema>;
export type UpdateSupportTicketStatusDto = z.infer<typeof updateSupportTicketStatusSchema>;
export type ListSupportTicketsQueryDto = z.infer<typeof listSupportTicketsQuerySchema>;
