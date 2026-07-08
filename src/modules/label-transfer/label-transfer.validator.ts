import { z } from 'zod';
import { objectId } from '@/validators/common.validator';

export const transferLabelSchema = z.object({
  labelId: objectId,
  toUserId: objectId,
});

export const labelTransferListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
});

export type TransferLabelDto = z.infer<typeof transferLabelSchema>;
export type LabelTransferListQueryDto = z.infer<typeof labelTransferListQuerySchema>;
