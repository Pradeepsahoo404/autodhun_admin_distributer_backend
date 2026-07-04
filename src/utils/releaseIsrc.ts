import { MusicReleaseModel } from '@/modules/music-release/music-release.model';

export const RELEASE_ISRC_SERIES_PREFIX = 'INA8D';

/** Example: INA8D2621862 — series (5) + year (2) + sequence (5) */
export const RELEASE_ISRC_PATTERN = /^INA8D\d{2}\d{5}$/;

export const RELEASE_ISRC_MESSAGE =
  'ISRC must match format INA8D2621862 (INA8D + 2-digit year + 5-digit sequence)';

export function getReleaseIsrcYearSuffix(date = new Date()): string {
  return String(date.getFullYear()).slice(-2);
}

export function buildReleaseIsrcPrefix(yearSuffix = getReleaseIsrcYearSuffix()): string {
  return `${RELEASE_ISRC_SERIES_PREFIX}${yearSuffix}`;
}

export function formatReleaseIsrc(sequence: number, yearSuffix = getReleaseIsrcYearSuffix()): string {
  return `${buildReleaseIsrcPrefix(yearSuffix)}${String(sequence).padStart(5, '0')}`;
}

export function isValidReleaseIsrc(value: string): boolean {
  return RELEASE_ISRC_PATTERN.test(value.trim().toUpperCase());
}

export async function findMaxReleaseIsrcSequence(
  yearSuffix = getReleaseIsrcYearSuffix(),
  seriesPrefix = RELEASE_ISRC_SERIES_PREFIX,
): Promise<number> {
  const prefix = `${seriesPrefix}${yearSuffix}`;
  const regex = new RegExp(`^${prefix}\\d{5}$`, 'i');

  const releases = await MusicReleaseModel.find({ 'tracks.isrc': { $regex: regex } }, { tracks: 1 }).lean();

  let max = 0;
  for (const release of releases) {
    for (const track of release.tracks ?? []) {
      const isrc = track.isrc?.trim().toUpperCase();
      if (!isrc || !regex.test(isrc)) continue;
      const seq = Number.parseInt(isrc.slice(prefix.length), 10);
      if (Number.isFinite(seq) && seq > max) max = seq;
    }
  }

  return max;
}

export async function allocateReleaseIsrcCodes(count: number): Promise<string[]> {
  if (count < 1) return [];

  const yearSuffix = getReleaseIsrcYearSuffix();
  let next = (await findMaxReleaseIsrcSequence(yearSuffix)) + 1;

  return Array.from({ length: count }, () => {
    const code = formatReleaseIsrc(next, yearSuffix);
    next += 1;
    return code;
  });
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
      isrc: track.isrc?.trim().toUpperCase() ?? '',
      isrcOption: 'own' as const,
    };
  });
}
