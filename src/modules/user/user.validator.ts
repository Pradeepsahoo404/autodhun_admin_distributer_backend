import { z } from 'zod';
import { objectId } from '@/validators/common.validator';
import { USER_STATUS } from '@/constants';

export const createUserSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().max(50).optional().default(''),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: objectId,
  status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.INACTIVE, USER_STATUS.BLOCKED]).optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().max(50).optional(),
  password: z.string().min(8).optional(),
  role: objectId.optional(),
  status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.INACTIVE, USER_STATUS.BLOCKED]).optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export const inviteAdminSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().max(50).optional().default(''),
  email: z.string().email('Enter a valid email').toLowerCase(),
  personalMessage: z.string().trim().max(500, 'Message must be at most 500 characters').optional(),
});

export const resendInviteSchema = z.object({
  personalMessage: z.string().trim().max(500, 'Message must be at most 500 characters').optional(),
});

export type InviteAdminDto = z.infer<typeof inviteAdminSchema>;
export type ResendInviteDto = z.infer<typeof resendInviteSchema>;
