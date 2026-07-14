import { z } from 'zod';
import { objectId } from '@/validators/common.validator';
import { USER_STATUS } from '@/constants';
import {
  nameField,
  optionalAddressField,
  optionalNameField,
  optionalTextField,
} from '@/validators/field.validator';

export const createUserSchema = z.object({
  firstName: nameField('First name'),
  lastName: optionalNameField('Last name'),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: objectId,
  status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.INACTIVE, USER_STATUS.BLOCKED]).optional(),
});

export const updateUserSchema = z.object({
  firstName: nameField('First name').optional(),
  lastName: optionalNameField('Last name'),
  password: z.string().min(8).optional(),
  role: objectId.optional(),
  status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.INACTIVE, USER_STATUS.BLOCKED]).optional(),
  postalAddress: optionalAddressField('Postal address', 300),
  state: optionalTextField('State', 100),
  countryRegion: optionalTextField('Country / Region', 100),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  labelName: optionalTextField('Label name', 120),
  bankName: optionalTextField('Bank name', 120),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{9,18}$/, 'Account number must be 9 to 18 digits')
    .optional()
    .or(z.literal('')),
  ifscCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, 'Enter a valid IFSC code')
    .optional()
    .or(z.literal('')),
  swiftCode: z.string().trim().max(11).optional().or(z.literal('')),
  micrCode: z.string().trim().regex(/^\d{9}$/, 'MICR code must be 9 digits').optional().or(z.literal('')),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export const inviteAdminSchema = z.object({
  firstName: nameField('First name'),
  lastName: optionalNameField('Last name'),
  email: z.string().email('Enter a valid email').toLowerCase(),
  personalMessage: z.string().trim().max(500, 'Message must be at most 500 characters').optional(),
  /** Required when Master invites; ignored for tenant Super Admin (own tenant). */
  tenantId: objectId.optional(),
});

export const resendInviteSchema = z.object({
  personalMessage: z.string().trim().max(500, 'Message must be at most 500 characters').optional(),
});

export type InviteAdminDto = z.infer<typeof inviteAdminSchema>;
export type ResendInviteDto = z.infer<typeof resendInviteSchema>;
