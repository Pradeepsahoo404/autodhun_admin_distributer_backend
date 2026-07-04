import { z } from 'zod';
import { nameField } from '@/validators/field.validator';
import { LABEL_STATUS_VALUES } from './release-catalog.constants';

export const catalogListQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const createCatalogNameSchema = z.object({
  name: nameField('Name', 120),
});

export const labelManageQuerySchema = z.object({
  status: z.enum(LABEL_STATUS_VALUES as [string, ...string[]]),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
});

export const updateLabelSchema = z.object({
  name: nameField('Label name', 120),
});

export const updateLabelStatusSchema = z.object({
  status: z.enum(LABEL_STATUS_VALUES as [string, ...string[]]),
});

export type CatalogListQueryDto = z.infer<typeof catalogListQuerySchema>;
export type CreateCatalogNameDto = z.infer<typeof createCatalogNameSchema>;
export type LabelManageQueryDto = z.infer<typeof labelManageQuerySchema>;
export type UpdateLabelDto = z.infer<typeof updateLabelSchema>;
export type UpdateLabelStatusDto = z.infer<typeof updateLabelStatusSchema>;
