import { z } from 'zod';
import {
  LETTERS_ONLY_MESSAGE,
  LETTERS_ONLY_PATTERN,
  catalogLabelField,
  nameField,
  optionalNameField,
} from '@/validators/field.validator';
import {
  isPastApiDate,
  isTodayOrPastApiDate,
  isValidCrbtStartTime,
  parseApiDateString,
  startOfDay,
} from '@/utils/releaseDateTime';
import {
  MUSIC_RELEASE_LIST_CONTEXT,
  MUSIC_RELEASE_STATUS,
  MUSIC_RELEASE_STATUS_VALUES,
} from './music-release.constants';

const yesNo = z.enum(['yes', 'no']);
const releaseType = z.enum(['single', 'ep', 'album']);
const isrcOption = z.enum(['own', 'generate']);
const priceTier = z.enum(['budget', 'back', 'mid', 'front', 'premium']);
const releasePlatform = z.enum([
  'all-excluding-youtube',
  'all-including-youtube',
  'only-youtube',
  'only-meta-audio',
]);

const apiDateField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => Boolean(parseApiDateString(value)), `${label} must be a valid date`);

const optionalUpcField = z
  .string()
  .trim()
  .max(20, 'UPC must be at most 20 characters')
  .refine((value) => value === '' || /^\d+$/.test(value), 'UPC must contain numbers only')
  .optional()
  .default('');

const optionalLineField = z
  .string()
  .trim()
  .max(200, 'Must be at most 200 characters')
  .refine((value) => value === '' || LETTERS_ONLY_PATTERN.test(value), LETTERS_ONLY_MESSAGE)
  .optional()
  .default('');

const trackSchema = z
  .object({
    title: nameField('Track title', 200),
    artist: nameField('Track artist', 120),
    lyrics: z.string().trim().max(5000).optional().default(''),
    isrcOption,
    isrc: z.string().trim().max(20).optional().default(''),
    composer: nameField('Composer', 120),
    producer: nameField('Producer', 120),
    director: nameField('Director', 120),
    language: catalogLabelField('Language', 120),
    genre: catalogLabelField('Genre', 120),
    subGenre: catalogLabelField('Sub genre', 120),
    price: priceTier,
  })
  .superRefine((track, ctx) => {
    if (track.isrcOption === 'own' && !track.isrc?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ISRC is required when using your own', path: ['isrc'] });
    }
  });

const crbtEntrySchema = z.object({
  title: nameField('CRBT title', 200),
  startTime: z
    .string()
    .trim()
    .min(1, 'Start time is required')
    .refine((value) => isValidCrbtStartTime(value), 'Start time must be valid (HH:MM:SS, e.g. 00:00:00)'),
});

const releaseBodyBase = z.object({
  title: nameField('Title', 200),
  version: optionalNameField('Version', 120).optional().default(''),
  artist: nameField('Artist', 120),
  releaseType,
  releasingDate: apiDateField('Releasing date'),
  label: nameField('Label', 120),
  instrumental: yesNo,
  explicit: yesNo,
  aiGenerated: yesNo,
  upc: optionalUpcField,
  pLine: optionalLineField,
  cLine: optionalLineField,
  tracks: z.array(trackSchema).min(1, 'At least one track is required'),
  crbtEntries: z.array(crbtEntrySchema).min(1, 'At least one CRBT entry is required'),
  scheduledReleaseDate: apiDateField('Scheduled release date'),
  scheduleNotes: z.string().trim().max(1000).optional().default(''),
  releasePlatform,
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
});

function applyReleaseDateRules(data: z.infer<typeof releaseBodyBase>, ctx: z.RefinementCtx): void {
  if (isPastApiDate(data.releasingDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Releasing date cannot be in the past',
      path: ['releasingDate'],
    });
  }

  if (isTodayOrPastApiDate(data.scheduledReleaseDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Scheduled release date must be a future date',
      path: ['scheduledReleaseDate'],
    });
  }

  const releaseDate = parseApiDateString(data.releasingDate);
  const scheduledDate = parseApiDateString(data.scheduledReleaseDate);
  if (
    releaseDate &&
    scheduledDate &&
    startOfDay(scheduledDate).getTime() < startOfDay(releaseDate).getTime()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Scheduled release date cannot be before releasing date',
      path: ['scheduledReleaseDate'],
    });
  }
}

export const createMusicReleaseBodySchema = releaseBodyBase.superRefine(applyReleaseDateRules);

export const updateStatusSchema = z
  .object({
    status: z.enum(MUSIC_RELEASE_STATUS_VALUES as [string, ...string[]]),
    correctionReasons: z.array(z.string().trim().min(1, 'Reason cannot be empty')).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === MUSIC_RELEASE_STATUS.CORRECTION && !data.correctionReasons?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Correction note is required',
        path: ['correctionReasons'],
      });
    }
  });

export const bulkUpdateStatusSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1, 'Select at least one release'),
    status: z.enum(MUSIC_RELEASE_STATUS_VALUES as [string, ...string[]]),
    correctionReasons: z.array(z.string().trim().min(1, 'Reason cannot be empty')).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === MUSIC_RELEASE_STATUS.CORRECTION && !data.correctionReasons?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Correction note is required',
        path: ['correctionReasons'],
      });
    }
  });

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.enum(MUSIC_RELEASE_STATUS_VALUES as [string, ...string[]]).optional(),
  context: z.enum([
    MUSIC_RELEASE_LIST_CONTEXT.ASSETS,
    MUSIC_RELEASE_LIST_CONTEXT.ASSETS_OVERVIEW,
    MUSIC_RELEASE_LIST_CONTEXT.CORRECTION,
    MUSIC_RELEASE_LIST_CONTEXT.CONTENT_DELIVERY,
  ]),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .optional(),
  sortBy: z.enum(['createdAt', 'title', 'status', 'releasingDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const exportQuerySchema = z.object({
  context: z.enum([
    MUSIC_RELEASE_LIST_CONTEXT.ASSETS,
    MUSIC_RELEASE_LIST_CONTEXT.ASSETS_OVERVIEW,
    MUSIC_RELEASE_LIST_CONTEXT.CORRECTION,
    MUSIC_RELEASE_LIST_CONTEXT.CONTENT_DELIVERY,
  ]),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .optional(),
});

export const nextIsrcQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(20).default(1),
});

export const checkIsrcQuerySchema = z.object({
  code: z.string().trim().min(1, 'ISRC code is required').max(20),
  excludeReleaseId: z.string().trim().optional(),
});

export type CreateMusicReleaseBodyDto = z.infer<typeof createMusicReleaseBodySchema>;
export const updateMusicReleaseBodySchema = createMusicReleaseBodySchema;
export type UpdateMusicReleaseBodyDto = z.infer<typeof updateMusicReleaseBodySchema>;
export type UpdateMusicReleaseStatusDto = z.infer<typeof updateStatusSchema>;
export type BulkUpdateMusicReleaseStatusDto = z.infer<typeof bulkUpdateStatusSchema>;
export type ListMusicReleasesQueryDto = z.infer<typeof listQuerySchema>;
export type ExportMusicReleasesQueryDto = z.infer<typeof exportQuerySchema>;
export type NextIsrcQueryDto = z.infer<typeof nextIsrcQuerySchema>;
export type CheckIsrcQueryDto = z.infer<typeof checkIsrcQuerySchema>;
