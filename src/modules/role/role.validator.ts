import { z } from 'zod';
import { ROLE_STATUS } from '@/constants';
import { optionalRoleDescriptionField, roleNameField } from '@/validators/field.validator';

const slugify = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const createRoleSchema = z
  .object({
    name: roleNameField,
    slug: z.string().optional(),
    description: optionalRoleDescriptionField,
    status: z.enum([ROLE_STATUS.ACTIVE, ROLE_STATUS.INACTIVE]).optional().default(ROLE_STATUS.ACTIVE),
  })
  .transform((d) => ({ ...d, slug: d.slug ? slugify(d.slug) : slugify(d.name) }));

export const updateRoleSchema = z.object({
  name: roleNameField.optional(),
  description: optionalRoleDescriptionField,
  status: z.enum([ROLE_STATUS.ACTIVE, ROLE_STATUS.INACTIVE]).optional(),
});

export type CreateRoleDto = z.infer<typeof createRoleSchema>;
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;
