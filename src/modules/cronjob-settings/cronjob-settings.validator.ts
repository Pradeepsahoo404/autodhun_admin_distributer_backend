import { z } from 'zod';

export const updateCronjobSettingsSchema = z.object({
  retentionDays: z.coerce.number().int().min(1).max(3650),
  enabled: z.boolean(),
});

export type UpdateCronjobSettingsDto = z.infer<typeof updateCronjobSettingsSchema>;
