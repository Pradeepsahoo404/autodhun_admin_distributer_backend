import { logger } from '@/config/logger';
import { RELEASE_LANGUAGES_SEED } from '@/constants/release-languages.seed';
import { RELEASE_GENRES_SEED } from '@/constants/release-genres.seed';
import { ReleaseLanguageModel } from '@/modules/release-catalog/release-language.model';
import { ReleaseGenreModel } from '@/modules/release-catalog/release-genre.model';

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export async function seedReleaseMetadata(): Promise<void> {
  for (let index = 0; index < RELEASE_LANGUAGES_SEED.length; index += 1) {
    const name = RELEASE_LANGUAGES_SEED[index];
    const normalizedName = normalizeName(name);
    await ReleaseLanguageModel.updateOne(
      { normalizedName },
      { $set: { name, normalizedName, sortOrder: index } },
      { upsert: true },
    );
  }

  for (let index = 0; index < RELEASE_GENRES_SEED.length; index += 1) {
    const { name, subGenres } = RELEASE_GENRES_SEED[index];
    const normalizedName = normalizeName(name);
    await ReleaseGenreModel.updateOne(
      { normalizedName },
      { $set: { name, normalizedName, subGenres: [...subGenres], sortOrder: index } },
      { upsert: true },
    );
  }

  logger.info(
    `Release metadata seeded (${RELEASE_LANGUAGES_SEED.length} languages, ${RELEASE_GENRES_SEED.length} genres)`,
  );
}
