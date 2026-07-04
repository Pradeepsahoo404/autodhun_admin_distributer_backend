import { ReleaseArtistModel, IReleaseArtist } from './release-artist.model';
import { ReleaseLabelModel, IReleaseLabel } from './release-label.model';
import { ApiError } from '@/utils/ApiError';
import { CatalogListQueryDto, CreateCatalogNameDto } from './release-catalog.validator';

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

async function listArtists(query: CatalogListQueryDto): Promise<IReleaseArtist[]> {
  const filter: Record<string, unknown> = {};
  if (query.search?.trim()) {
    filter.name = { $regex: query.search.trim(), $options: 'i' };
  }
  return ReleaseArtistModel.find(filter)
    .sort({ name: 1 })
    .limit(query.limit)
    .exec();
}

async function listLabels(query: CatalogListQueryDto): Promise<IReleaseLabel[]> {
  const filter: Record<string, unknown> = {};
  if (query.search?.trim()) {
    filter.name = { $regex: query.search.trim(), $options: 'i' };
  }
  return ReleaseLabelModel.find(filter)
    .sort({ name: 1 })
    .limit(query.limit)
    .exec();
}

async function createArtist(dto: CreateCatalogNameDto, userId: string): Promise<IReleaseArtist> {
  const name = dto.name.trim();
  const normalizedName = normalizeName(name);
  const existing = await ReleaseArtistModel.findOne({ normalizedName }).exec();
  if (existing) throw ApiError.conflict('An artist with this name already exists');

  try {
    return await ReleaseArtistModel.create({
      name,
      normalizedName,
      createdBy: userId,
    });
  } catch {
    const duplicate = await ReleaseArtistModel.findOne({ normalizedName }).exec();
    if (duplicate) throw ApiError.conflict('An artist with this name already exists');
    throw ApiError.badRequest('Could not create artist');
  }
}

async function createLabel(dto: CreateCatalogNameDto, userId: string): Promise<IReleaseLabel> {
  const name = dto.name.trim();
  const normalizedName = normalizeName(name);
  const existing = await ReleaseLabelModel.findOne({ normalizedName }).exec();
  if (existing) throw ApiError.conflict('A label with this name already exists');

  try {
    return await ReleaseLabelModel.create({
      name,
      normalizedName,
      createdBy: userId,
    });
  } catch {
    const duplicate = await ReleaseLabelModel.findOne({ normalizedName }).exec();
    if (duplicate) throw ApiError.conflict('A label with this name already exists');
    throw ApiError.badRequest('Could not create label');
  }
}

export const releaseCatalogService = {
  listArtists,
  listLabels,
  createArtist,
  createLabel,
};
