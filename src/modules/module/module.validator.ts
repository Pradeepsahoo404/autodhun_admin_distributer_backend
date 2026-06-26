import { z } from 'zod';

const slugify = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const createModuleSchema = z
  .object({
    name: z.string().min(2).max(50),
    slug: z.string().optional(),
    route: z.string().min(1, 'Route is required'),
    icon: z.string().optional().default('Circle'),
    order: z.coerce.number().int().min(0).optional().default(0),
    isActive: z.boolean().optional().default(true),
    isPro: z.boolean().optional().default(false),
    group: z.enum(['main', 'management']).optional().default('main'),
  })
  .transform((d) => ({ ...d, slug: d.slug ? slugify(d.slug) : slugify(d.name) }));

export const updateModuleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  route: z.string().min(1).optional(),
  icon: z.string().optional(),
  order: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isPro: z.boolean().optional(),
  group: z.enum(['main', 'management']).optional(),
});

export type CreateModuleDto = z.infer<typeof createModuleSchema>;
export type UpdateModuleDto = z.infer<typeof updateModuleSchema>;
