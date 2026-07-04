import { z } from 'zod';
import { objectId } from '@/validators/common.validator';

export const transferLabelSchema = z.object({
  labelId: objectId,
  toUserId: objectId,
});

export type TransferLabelDto = z.infer<typeof transferLabelSchema>;
