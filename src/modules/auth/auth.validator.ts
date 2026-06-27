import { z } from 'zod';
import { OTP_PURPOSE } from '@/constants';
import {
  addressField,
  nameField,
  optionalNameField,
  textField,
} from '@/validators/field.validator';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

const otpSchema = z.string().regex(/^\d{4,8}$/, 'OTP must be 4-8 digits');

export const registerSchema = z
  .object({
    firstName: nameField('First name'),
    lastName: optionalNameField('Last name'),
    email: z.string().email('A valid email is required').toLowerCase(),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms to continue' }) }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().email('A valid email is required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms to continue' }) }),
});

export const acceptTermsSchema = z.object({
  email: z.string().email('A valid email is required').toLowerCase(),
});

export const termsStatusQuerySchema = z.object({
  email: z.string().email('A valid email is required').toLowerCase(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email().toLowerCase(),
  otp: otpSchema,
});

export const resendOtpSchema = z.object({
  email: z.string().email().toLowerCase(),
  purpose: z.enum([OTP_PURPOSE.REGISTER, OTP_PURPOSE.LOGIN, OTP_PURPOSE.FORGOT_PASSWORD]),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('A valid email is required').toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    email: z.string().email('A valid email is required').toLowerCase(),
    otp: otpSchema,
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const googleAuthSchema = z.object({
  idToken: z.string().min(10, 'Google ID token is required'),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms to continue' }) }),
});

const optionalCode = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || pattern.test(value), { message })
    .optional()
    .or(z.literal(''));

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const updateProfileSchema = z.object({
  firstName: nameField('First name'),
  lastName: optionalNameField('Last name'),
  postalAddress: addressField('Postal address', 300),
  state: textField('State', 100),
  countryRegion: textField('Country / Region', 100),
  phoneNumber: z
    .string()
    .trim()
    .min(1, 'Phone number is required')
    .regex(/^\+?[0-9]{10,15}$/, 'Enter a valid phone number'),
  labelName: textField('Label name', 120),
});

export const updateBankDetailsSchema = z.object({
  bankName: z
    .string()
    .trim()
    .min(1, 'Bank name is required')
    .max(120, 'Bank name must be at most 120 characters')
    .regex(/^[A-Za-z][A-Za-z\s.&'-]*$/, 'Bank name must contain only letters'),
  accountNumber: z
    .string()
    .trim()
    .min(1, 'Account number is required')
    .regex(/^\d{9,18}$/, 'Account number must be 9 to 18 digits'),
  ifscCode: z
    .string()
    .trim()
    .min(1, 'IFSC code is required')
    .regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, 'Enter a valid IFSC code'),
  swiftCode: optionalCode(/^[A-Za-z0-9]{8,11}$/, 'Enter a valid SWIFT code'),
  micrCode: optionalCode(/^\d{9}$/, 'MICR code must be 9 digits'),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;
