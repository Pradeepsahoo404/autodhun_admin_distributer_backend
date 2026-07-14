import { z } from 'zod';
import { TENANT_STATUS } from '@/constants/tenant';
import { objectId } from '@/validators/common.validator';
import { nameField, optionalNameField } from '@/validators/field.validator';

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

export const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
  status: z.enum([TENANT_STATUS.ACTIVE, TENANT_STATUS.INACTIVE]).optional(),
  superAdmin: z.object({
    firstName: nameField('First name'),
    lastName: optionalNameField('Last name'),
    email: z.string().email().toLowerCase().trim(),
    /** Optional — a secure password is generated and emailed when omitted. */
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  }),
});

export const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum([TENANT_STATUS.ACTIVE, TENANT_STATUS.INACTIVE]).optional(),
});

export const listTenantsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum([TENANT_STATUS.ACTIVE, TENANT_STATUS.INACTIVE]).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const tenantIdParamSchema = z.object({ id: objectId });

export type CreateTenantDto = z.infer<typeof createTenantSchema>;
export type UpdateTenantDto = z.infer<typeof updateTenantSchema>;
export type ListTenantsQueryDto = z.infer<typeof listTenantsQuerySchema>;
