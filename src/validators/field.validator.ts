import { z } from 'zod';

export const LETTERS_ONLY_PATTERN = /^[A-Za-z\s.'-]+$/;
export const LETTERS_ONLY_MESSAGE =
  'Only letters and spaces are allowed (no numbers or special characters)';

export const ADDRESS_PATTERN = /^[A-Za-z0-9\s.,#'/-]+$/;
export const ADDRESS_MESSAGE =
  'Address may contain letters, numbers, spaces, and basic punctuation only';

export const ISRC_PATTERN = /^[A-Za-z0-9-]+$/;
export const ISRC_MESSAGE = 'ISRC must contain only letters, numbers, and hyphens';

export const INSTAGRAM_HANDLE_PATTERN = /^[A-Za-z._-]+$/;
export const INSTAGRAM_HANDLE_MESSAGE =
  'Instagram handle may contain only letters, dots, underscores, and hyphens';

export const ROLE_DESCRIPTION_PATTERN = /^[A-Za-z0-9\s.,!?'()-]*$/;
export const ROLE_DESCRIPTION_MESSAGE =
  'Description may contain only letters, numbers, spaces, and basic punctuation';

export const textField = (label: string, max = 200) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)
    .regex(LETTERS_ONLY_PATTERN, LETTERS_ONLY_MESSAGE);

export const optionalTextField = (label: string, max = 200) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .refine((value) => value === '' || LETTERS_ONLY_PATTERN.test(value), LETTERS_ONLY_MESSAGE)
    .optional()
    .or(z.literal(''));

export const nameField = (label: string, max = 50) => textField(label, max);

export const optionalNameField = (label: string, max = 50) => optionalTextField(label, max);

export const addressField = (label: string, max = 300) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)
    .regex(ADDRESS_PATTERN, ADDRESS_MESSAGE);

export const optionalAddressField = (label: string, max = 300) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .refine((value) => value === '' || ADDRESS_PATTERN.test(value), ADDRESS_MESSAGE)
    .optional()
    .or(z.literal(''));

export const isrcField = z
  .string()
  .trim()
  .min(1, 'ISRC is required')
  .max(20, 'ISRC must be at most 20 characters')
  .regex(ISRC_PATTERN, ISRC_MESSAGE)
  .transform((value) => value.toUpperCase());

export const urlField = (label: string, max = 500) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .url(`Enter a valid ${label.toLowerCase()}`)
    .max(max, `${label} must be at most ${max} characters`);

export const facebookPageLinkField = urlField('Facebook page link').refine(
  (url) => /facebook\.com|fb\.com/i.test(url),
  'Enter a valid Facebook page link',
);

export const instagramHandleField = z
  .string()
  .trim()
  .min(1, 'Instagram handle name is required')
  .max(100, 'Instagram handle name must be at most 100 characters')
  .regex(INSTAGRAM_HANDLE_PATTERN, INSTAGRAM_HANDLE_MESSAGE);

export const roleNameField = z
  .string()
  .trim()
  .min(2, 'Role name is required')
  .max(50, 'Role name must be at most 50 characters')
  .regex(LETTERS_ONLY_PATTERN, LETTERS_ONLY_MESSAGE);

export const optionalRoleDescriptionField = z
  .string()
  .trim()
  .max(255, 'Description must be at most 255 characters')
  .refine((value) => value === '' || ROLE_DESCRIPTION_PATTERN.test(value), ROLE_DESCRIPTION_MESSAGE)
  .optional()
  .or(z.literal(''));
