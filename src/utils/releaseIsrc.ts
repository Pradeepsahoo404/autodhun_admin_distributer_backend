import { Types } from 'mongoose';
import { MusicReleaseModel } from '@/modules/music-release/music-release.model';
import { ApiError } from '@/utils/ApiError';

export const RELEASE_ISRC_SERIES_PREFIX = 'INA8D';

/** Example: INA8D2621862 — series (5) + year (2) + sequence (5) */
export const RELEASE_ISRC_PATTERN = /^INA8D\d{2}\d{5}$/;

export const RELEASE_ISRC_MESSAGE =
  'ISRC must match format INA8D2621862 (INA8D + 2-digit year + 5-digit sequence)';

export const RELEASE_ISRC_MIN_SEQUENCE = 21862;

const MAX_ALLOCATION_ATTEMPTS = 100_000;

export function getReleaseIsrcYearSuffix(date = new Date()): string {
  return String(date.getFullYear()).slice(-2);
}

export function buildReleaseIsrcPrefix(yearSuffix = getReleaseIsrcYearSuffix()): string {
  return `${RELEASE_ISRC_SERIES_PREFIX}${yearSuffix}`;
}

export function formatReleaseIsrc(sequence: number, yearSuffix = getReleaseIsrcYearSuffix()): string {
  return `${buildReleaseIsrcPrefix(yearSuffix)}${String(sequence).padStart(5, '0')}`;
}

export function normalizeReleaseIsrc(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidReleaseIsrc(value: string): boolean {
  return RELEASE_ISRC_PATTERN.test(normalizeReleaseIsrc(value));
}

export async function isReleaseIsrcTaken(
  isrc: string,
  excludeReleaseId?: string,
): Promise<boolean> {
  const normalized = normalizeReleaseIsrc(isrc);
  if (!normalized) return false;

  const filter: Record<string, unknown> = { 'tracks.isrc': normalized };
  if (excludeReleaseId && Types.ObjectId.isValid(excludeReleaseId)) {
    filter._id = { $ne: new Types.ObjectId(excludeReleaseId) };
  }

  const count = await MusicReleaseModel.countDocuments(filter);
  return count > 0;
}

/** Max sequence from generated ISRCs only — manual/own ISRCs do not advance the series. */
export async function findMaxGeneratedIsrcSequence(
  yearSuffix = getReleaseIsrcYearSuffix(),
): Promise<number> {
  const prefix = buildReleaseIsrcPrefix(yearSuffix);
  const regex = new RegExp(`^${prefix}\\d{5}$`, 'i');

  const releases = await MusicReleaseModel.find(
    { 'tracks.isrcOption': 'generate', 'tracks.isrc': { $regex: regex } },
    { tracks: 1 },
  ).lean();

  let max = 0;
  for (const release of releases) {
    for (const track of release.tracks ?? []) {
      if (track.isrcOption !== 'generate') continue;
      const isrc = track.isrc?.trim().toUpperCase();
      if (!isrc || !regex.test(isrc)) continue;
      const seq = Number.parseInt(isrc.slice(prefix.length), 10);
      if (Number.isFinite(seq) && seq > max) max = seq;
    }
  }

  return Math.max(max, RELEASE_ISRC_MIN_SEQUENCE - 1);
}

async function getAllTakenIsrcs(): Promise<Set<string>> {
  const releases = await MusicReleaseModel.find({ 'tracks.isrc': { $ne: '' } }, { tracks: 1 }).lean();
  const taken = new Set<string>();

  for (const release of releases) {
    for (const track of release.tracks ?? []) {
      const isrc = track.isrc?.trim().toUpperCase();
      if (isrc) taken.add(isrc);
    }
  }

  return taken;
}

export async function allocateReleaseIsrcCodes(count: number): Promise<string[]> {
  if (count < 1) return [];

  const yearSuffix = getReleaseIsrcYearSuffix();
  let nextSeq = (await findMaxGeneratedIsrcSequence(yearSuffix)) + 1;
  const taken = await getAllTakenIsrcs();

  const codes: string[] = [];
  let attempts = 0;

  while (codes.length < count && attempts < MAX_ALLOCATION_ATTEMPTS) {
    attempts += 1;
    const candidate = formatReleaseIsrc(nextSeq, yearSuffix);
    nextSeq += 1;

    if (!taken.has(candidate)) {
      codes.push(candidate);
      taken.add(candidate);
    }
  }

  if (codes.length < count) {
    throw ApiError.internal('Unable to allocate enough unique ISRC codes');
  }

  return codes;
}

export async function previewNextReleaseIsrc(count = 1): Promise<string[]> {
  return allocateReleaseIsrcCodes(count);
}

interface TrackIsrcInput {
  isrcOption: 'own' | 'generate';
  isrc?: string;
}

interface ExistingTrackIsrc {
  isrcOption: 'own' | 'generate';
  isrc?: string;
}

export async function assertOwnIsrcsAvailable(
  tracks: TrackIsrcInput[],
  excludeReleaseId?: string,
): Promise<void> {
  const seenInForm = new Set<string>();

  for (const track of tracks) {
    if (track.isrcOption !== 'own') continue;

    const normalized = normalizeReleaseIsrc(track.isrc ?? '');
    if (!normalized) continue;

    if (seenInForm.has(normalized)) {
      throw ApiError.conflict(`ISRC "${normalized}" is already used on another track in this release`);
    }
    seenInForm.add(normalized);

    if (await isReleaseIsrcTaken(normalized, excludeReleaseId)) {
      throw ApiError.conflict(`ISRC "${normalized}" is already taken`);
    }
  }
}

export async function resolveTracksIsrc<T extends TrackIsrcInput>(
  tracks: T[],
  existingTracks: ExistingTrackIsrc[] = [],
): Promise<T[]> {
  const generateIndexes: number[] = [];

  tracks.forEach((track, index) => {
    const existing = existingTracks[index];
    const hasLockedGenerated =
      track.isrcOption === 'generate' &&
      existing?.isrcOption === 'generate' &&
      Boolean(existing.isrc?.trim());

    if (track.isrcOption === 'generate' && !hasLockedGenerated) {
      generateIndexes.push(index);
    }
  });

  const generatedCodes =
    generateIndexes.length > 0 ? await allocateReleaseIsrcCodes(generateIndexes.length) : [];

  let generatedCursor = 0;

  return tracks.map((track, index) => {
    const existing = existingTracks[index];

    if (track.isrcOption === 'generate') {
      const lockedIsrc = existing?.isrcOption === 'generate' ? existing.isrc?.trim() : '';
      if (lockedIsrc) {
        return { ...track, isrc: lockedIsrc.toUpperCase(), isrcOption: 'generate' as const };
      }

      const isrc = generatedCodes[generatedCursor] ?? '';
      generatedCursor += 1;
      return { ...track, isrc, isrcOption: 'generate' as const };
    }

    return {
      ...track,
      isrc: normalizeReleaseIsrc(track.isrc ?? ''),
      isrcOption: 'own' as const,
    };
  });
}
