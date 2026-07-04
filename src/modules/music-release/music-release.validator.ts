import { z } from 'zod';
import {
  RELEASE_ISRC_MESSAGE,
  RELEASE_ISRC_PATTERN,
  isValidReleaseIsrc,
} from '@/utils/releaseIsrc';
import {
  LETTERS_ONLY_MESSAGE,
  LETTERS_ONLY_PATTERN,
  nameField,
  optionalNameField,
} from '@/validators/field.validator';
import {
  isPastApiDate,
  isPastTimeForToday,
  parseApiDateString,
  parseTimeToMinutes,
  startOfDay,
} from '@/utils/releaseDateTime';
import {
  MUSIC_RELEASE_LIST_CONTEXT,
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
    composer: optionalNameField('Composer', 120).optional().default(''),
    producer: optionalNameField('Producer', 120).optional().default(''),
    director: optionalNameField('Director', 120).optional().default(''),
    language: optionalNameField('Language', 80).optional().default(''),
    genre: optionalNameField('Genre', 80).optional().default(''),
    subGenre: optionalNameField('Sub genre', 80).optional().default(''),
    price: priceTier,
  })
  .superRefine((track, ctx) => {
    if (track.isrcOption === 'own') {
      if (!track.isrc?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ISRC is required when using your own', path: ['isrc'] });
        return;
      }
      if (!isValidReleaseIsrc(track.isrc.trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: RELEASE_ISRC_MESSAGE, path: ['isrc'] });
      }
      return;
    }

    if (track.isrc?.trim() && !RELEASE_ISRC_PATTERN.test(track.isrc.trim().toUpperCase())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: RELEASE_ISRC_MESSAGE, path: ['isrc'] });
    }
  });

const crbtEntrySchema = z.object({
  title: nameField('CRBT title', 200),
  startTime: z
    .string()
    .trim()
    .min(1, 'Start time is required')
    .refine((value) => parseTimeToMinutes(value) !== null, 'Start time must be valid (HH:mm)'),
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

function todayApiDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function applyReleaseDateRules(data: z.infer<typeof releaseBodyBase>, ctx: z.RefinementCtx): void {
  if (isPastApiDate(data.releasingDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Releasing date cannot be in the past',
      path: ['releasingDate'],
    });
  }

  if (isPastApiDate(data.scheduledReleaseDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Scheduled release date cannot be in the past',
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

  if (data.releasingDate === todayApiDate()) {
    data.crbtEntries.forEach((entry, index) => {
      if (isPastTimeForToday(entry.startTime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Start time cannot be in the past when releasing today',
          path: ['crbtEntries', index, 'startTime'],
        });
      }
    });
  }
}

export const createMusicReleaseBodySchema = releaseBodyBase.superRefine(applyReleaseDateRules);

export const updateStatusSchema = z.object({
  status: z.enum(MUSIC_RELEASE_STATUS_VALUES as [string, ...string[]]),
});

export const bulkUpdateStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'Select at least one release'),
  status: z.enum(MUSIC_RELEASE_STATUS_VALUES as [string, ...string[]]),
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

export type CreateMusicReleaseBodyDto = z.infer<typeof createMusicReleaseBodySchema>;
export const updateMusicReleaseBodySchema = createMusicReleaseBodySchema;
export type UpdateMusicReleaseBodyDto = z.infer<typeof updateMusicReleaseBodySchema>;
export type UpdateMusicReleaseStatusDto = z.infer<typeof updateStatusSchema>;
export type BulkUpdateMusicReleaseStatusDto = z.infer<typeof bulkUpdateStatusSchema>;
export type ListMusicReleasesQueryDto = z.infer<typeof listQuerySchema>;
export type ExportMusicReleasesQueryDto = z.infer<typeof exportQuerySchema>;
export type NextIsrcQueryDto = z.infer<typeof nextIsrcQuerySchema>;
