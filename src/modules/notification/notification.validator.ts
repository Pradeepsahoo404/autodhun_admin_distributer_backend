import { z } from 'zod';
import { paginationQuerySchema } from '@/validators/common.validator';

export const listNotificationQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type ListNotificationQueryDto = z.infer<typeof listNotificationQuerySchema>;
