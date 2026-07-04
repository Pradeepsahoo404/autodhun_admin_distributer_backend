import { z } from 'zod';
import { nameField } from '@/validators/field.validator';

export const catalogListQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const createCatalogNameSchema = z.object({
  name: nameField('Name', 120),
});

export type CatalogListQueryDto = z.infer<typeof catalogListQuerySchema>;
export type CreateCatalogNameDto = z.infer<typeof createCatalogNameSchema>;
