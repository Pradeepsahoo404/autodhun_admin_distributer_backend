import { z } from 'zod';
import { ROLE_STATUS } from '@/constants';

const slugify = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const createRoleSchema = z
  .object({
    name: z.string().min(2, 'Role name is required').max(50),
    slug: z.string().optional(),
    description: z.string().max(255).optional().default(''),
    status: z.enum([ROLE_STATUS.ACTIVE, ROLE_STATUS.INACTIVE]).optional().default(ROLE_STATUS.ACTIVE),
  })
  .transform((d) => ({ ...d, slug: d.slug ? slugify(d.slug) : slugify(d.name) }));

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(255).optional(),
  status: z.enum([ROLE_STATUS.ACTIVE, ROLE_STATUS.INACTIVE]).optional(),
});

export type CreateRoleDto = z.infer<typeof createRoleSchema>;
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;
