import * as XLSX from 'xlsx';
import { z } from 'zod';
import { ApiError } from '@/utils/ApiError';
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

export interface BulkColumn {
  key: string;
  header: string;
  required: boolean;
  note: string;
  example: string;
}

/**
 * One spreadsheet row = one release with a single track and a single CRBT entry.
 * Column order here is the exact order rendered in the downloadable template.
 */
export const BULK_RELEASE_COLUMNS: BulkColumn[] = [
  { key: 'title', header: 'Title', required: true, note: 'Release title (letters only).', example: 'Midnight Skyline' },
  { key: 'version', header: 'Version', required: false, note: 'Optional version/subtitle (letters only).', example: 'Acoustic' },
  { key: 'artist', header: 'Primary Artist', required: true, note: 'Main release artist (letters only).', example: 'Aria Nova' },
  { key: 'releaseType', header: 'Release Type', required: true, note: 'One of: single, ep, album.', example: 'single' },
  { key: 'releasingDate', header: 'Releasing Date', required: true, note: 'Format YYYY-MM-DD. Cannot be in the past.', example: '2026-08-01' },
  { key: 'label', header: 'Label', required: true, note: 'Must be a label you own and that is active.', example: 'JAI HO' },
  { key: 'instrumental', header: 'Instrumental', required: false, note: 'yes or no (default no).', example: 'no' },
  { key: 'explicit', header: 'Explicit', required: false, note: 'yes or no (default no).', example: 'no' },
  { key: 'aiGenerated', header: 'AI Generated', required: false, note: 'yes or no (default no).', example: 'no' },
  { key: 'upc', header: 'UPC', required: false, note: 'Optional. Digits only.', example: '' },
  { key: 'pLine', header: 'P Line', required: false, note: 'Optional (letters only).', example: '' },
  { key: 'cLine', header: 'C Line', required: false, note: 'Optional (letters only).', example: '' },
  { key: 'scheduledReleaseDate', header: 'Scheduled Release Date', required: true, note: 'Format YYYY-MM-DD. Must be a future date and on/after Releasing Date.', example: '2026-08-05' },
  { key: 'scheduleNotes', header: 'Schedule Notes', required: false, note: 'Optional free text.', example: '' },
  { key: 'releasePlatform', header: 'Release Platform', required: true, note: 'One of: all-excluding-youtube, all-including-youtube, only-youtube, only-meta-audio.', example: 'all-excluding-youtube' },
  { key: 'trackTitle', header: 'Track Title', required: true, note: 'Track title (letters only).', example: 'Midnight Skyline' },
  { key: 'trackArtist', header: 'Track Artist', required: true, note: 'Track artist (letters only).', example: 'Aria Nova' },
  { key: 'lyrics', header: 'Lyrics', required: false, note: 'Optional lyrics text.', example: '' },
  { key: 'isrcOption', header: 'ISRC Option', required: true, note: 'own or generate. Use generate to auto-assign.', example: 'generate' },
  { key: 'isrc', header: 'ISRC', required: false, note: 'Required only when ISRC Option is own.', example: '' },
  { key: 'composer', header: 'Composer', required: true, note: 'Composer name (letters only).', example: 'Aria Nova' },
  { key: 'producer', header: 'Producer', required: true, note: 'Producer name (letters only).', example: 'Leo Mercer' },
  { key: 'director', header: 'Director', required: true, note: 'Director name (letters only).', example: 'Leo Mercer' },
  { key: 'language', header: 'Language', required: true, note: 'Language name (e.g. Hindi, English).', example: 'English' },
  { key: 'genre', header: 'Genre', required: true, note: 'Genre name (e.g. Pop).', example: 'Pop' },
  { key: 'subGenre', header: 'Sub Genre', required: true, note: 'Sub genre name (e.g. Indie Pop).', example: 'Indie Pop' },
  { key: 'price', header: 'Price', required: true, note: 'One of: budget, back, mid, front, premium.', example: 'mid' },
  { key: 'crbtTitle', header: 'CRBT Title', required: true, note: 'CRBT title (letters only).', example: 'Midnight Skyline' },
  { key: 'crbtStartTime', header: 'CRBT Start Time', required: true, note: 'Format HH:MM:SS (e.g. 00:00:30).', example: '00:00:30' },
];

const yesNo = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.enum(['yes', 'no']),
);
const releaseType = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.enum(['single', 'ep', 'album']),
);
const isrcOption = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.enum(['own', 'generate']),
);
const priceTier = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.enum(['budget', 'back', 'mid', 'front', 'premium']),
);
const releasePlatform = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.enum(['all-excluding-youtube', 'all-including-youtube', 'only-youtube', 'only-meta-audio']),
);

const optionalYesNo = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  yesNo.optional().default('no'),
);

const apiDateField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => Boolean(parseApiDateString(value)), `${label} must be a valid date (YYYY-MM-DD)`);

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

export const bulkReleaseRowSchema = z
  .object({
    title: nameField('Title', 200),
    version: optionalNameField('Version', 120).optional().default(''),
    artist: nameField('Primary Artist', 120),
    releaseType,
    releasingDate: apiDateField('Releasing Date'),
    label: nameField('Label', 120),
    instrumental: optionalYesNo,
    explicit: optionalYesNo,
    aiGenerated: optionalYesNo,
    upc: optionalUpcField,
    pLine: optionalLineField,
    cLine: optionalLineField,
    scheduledReleaseDate: apiDateField('Scheduled Release Date'),
    scheduleNotes: z.string().trim().max(1000).optional().default(''),
    releasePlatform,
    trackTitle: nameField('Track Title', 200),
    trackArtist: nameField('Track Artist', 120),
    lyrics: z.string().trim().max(5000).optional().default(''),
    isrcOption,
    isrc: z.string().trim().max(20).optional().default(''),
    composer: nameField('Composer', 120),
    producer: nameField('Producer', 120),
    director: nameField('Director', 120),
    language: catalogLabelField('Language', 120),
    genre: catalogLabelField('Genre', 120),
    subGenre: catalogLabelField('Sub Genre', 120),
    price: priceTier,
    crbtTitle: nameField('CRBT Title', 200),
    crbtStartTime: z
      .string()
      .trim()
      .min(1, 'CRBT Start Time is required')
      .refine((value) => isValidCrbtStartTime(value), 'CRBT Start Time must be valid (HH:MM:SS)'),
  })
  .superRefine((data, ctx) => {
    if (data.isrcOption === 'own' && !data.isrc?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ISRC is required when ISRC Option is own', path: ['isrc'] });
    }

    if (isPastApiDate(data.releasingDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Releasing Date cannot be in the past', path: ['releasingDate'] });
    }

    if (isTodayOrPastApiDate(data.scheduledReleaseDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Scheduled Release Date must be a future date', path: ['scheduledReleaseDate'] });
    }

    const releaseDate = parseApiDateString(data.releasingDate);
    const scheduledDate = parseApiDateString(data.scheduledReleaseDate);
    if (releaseDate && scheduledDate && startOfDay(scheduledDate).getTime() < startOfDay(releaseDate).getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Scheduled Release Date cannot be before Releasing Date', path: ['scheduledReleaseDate'] });
    }
  });

export type BulkReleaseRow = z.infer<typeof bulkReleaseRowSchema>;

export interface ParsedBulkRelease {
  rowNumber: number;
  title: string;
  version: string;
  artist: string;
  releaseType: 'single' | 'ep' | 'album';
  releasingDate: string;
  label: string;
  instrumental: 'yes' | 'no';
  explicit: 'yes' | 'no';
  aiGenerated: 'yes' | 'no';
  upc: string;
  pLine: string;
  cLine: string;
  scheduledReleaseDate: string;
  scheduleNotes: string;
  releasePlatform: BulkReleaseRow['releasePlatform'];
  tracks: Array<{
    title: string;
    artist: string;
    lyrics: string;
    isrcOption: 'own' | 'generate';
    isrc: string;
    composer: string;
    producer: string;
    director: string;
    language: string;
    genre: string;
    subGenre: string;
    price: BulkReleaseRow['price'];
  }>;
  crbtEntries: Array<{ title: string; startTime: string }>;
}

export interface BulkRowError {
  row: number;
  field: string;
  message: string;
}

export interface BulkParseResult {
  releases: ParsedBulkRelease[];
  errors: BulkRowError[];
  totalRows: number;
}

function normalizeHeader(header: string): string {
  return header.trim().replace(/\s*\*+\s*$/, '').trim().toLowerCase();
}

const HEADER_TO_KEY = new Map(BULK_RELEASE_COLUMNS.map((c) => [normalizeHeader(c.header), c.key]));

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).trim();
}

function mapRowToKeyed(raw: Record<string, unknown>): Record<string, string> {
  const keyed: Record<string, string> = {};
  for (const [header, value] of Object.entries(raw)) {
    const key = HEADER_TO_KEY.get(normalizeHeader(header));
    if (key) keyed[key] = normalizeCell(value);
  }
  return keyed;
}

function toParsedRelease(row: BulkReleaseRow, rowNumber: number): ParsedBulkRelease {
  return {
    rowNumber,
    title: row.title,
    version: row.version,
    artist: row.artist,
    releaseType: row.releaseType,
    releasingDate: row.releasingDate,
    label: row.label,
    instrumental: row.instrumental,
    explicit: row.explicit,
    aiGenerated: row.aiGenerated,
    upc: row.upc,
    pLine: row.pLine,
    cLine: row.cLine,
    scheduledReleaseDate: row.scheduledReleaseDate,
    scheduleNotes: row.scheduleNotes,
    releasePlatform: row.releasePlatform,
    tracks: [
      {
        title: row.trackTitle,
        artist: row.trackArtist,
        lyrics: row.lyrics,
        isrcOption: row.isrcOption,
        isrc: row.isrc,
        composer: row.composer,
        producer: row.producer,
        director: row.director,
        language: row.language,
        genre: row.genre,
        subGenre: row.subGenre,
        price: row.price,
      },
    ],
    crbtEntries: [{ title: row.crbtTitle, startTime: row.crbtStartTime }],
  };
}

function isEmptyRow(keyed: Record<string, string>): boolean {
  return Object.values(keyed).every((v) => v === '');
}

/** Reads and validates an uploaded spreadsheet buffer into structured releases + per-row errors. */
export function parseBulkReleaseWorkbook(buffer: Buffer): BulkParseResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch {
    throw ApiError.badRequest('Could not read the file. Upload a valid .xlsx or .csv file.');
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw ApiError.badRequest('The uploaded file has no sheets.');

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  const releases: ParsedBulkRelease[] = [];
  const errors: BulkRowError[] = [];
  let totalRows = 0;

  rawRows.forEach((raw, index) => {
    const keyed = mapRowToKeyed(raw);
    if (isEmptyRow(keyed)) return;

    totalRows += 1;
    // +2: 1 for header row, 1 for 1-based indexing → matches the spreadsheet row number.
    const rowNumber = index + 2;

    const result = bulkReleaseRowSchema.safeParse(keyed);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? '');
        const column = BULK_RELEASE_COLUMNS.find((c) => c.key === key);
        errors.push({ row: rowNumber, field: column?.header ?? key, message: issue.message });
      }
      return;
    }

    releases.push(toParsedRelease(result.data, rowNumber));
  });

  return { releases, errors, totalRows };
}

/** Builds the downloadable Excel template (headers + instructions + one example row). */
export function buildBulkTemplateWorkbook(): Buffer {
  const workbook = XLSX.utils.book_new();

  const headers = BULK_RELEASE_COLUMNS.map((c) => (c.required ? `${c.header} *` : c.header));
  const exampleRow = BULK_RELEASE_COLUMNS.map((c) => c.example);

  const templateSheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  templateSheet['!cols'] = BULK_RELEASE_COLUMNS.map((c) => ({
    wch: Math.max(c.header.length + 4, 16),
  }));
  XLSX.utils.book_append_sheet(workbook, templateSheet, 'Releases');

  const instructionRows: string[][] = [
    ['Column', 'Required', 'Instructions'],
    ...BULK_RELEASE_COLUMNS.map((c) => [c.header, c.required ? 'Yes' : 'No', c.note]),
    [],
    ['Notes', '', ''],
    ['', '', 'Each row creates one release with one track and one CRBT entry.'],
    ['', '', 'Do not rename or reorder the header row on the "Releases" sheet.'],
    ['', '', 'Columns marked with * are required.'],
    ['', '', 'Audio files and cover art are added later — they are not part of this import.'],
    ['', '', 'Delete the example row before uploading.'],
  ];
  const instructionSheet = XLSX.utils.aoa_to_sheet(instructionRows);
  instructionSheet['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
