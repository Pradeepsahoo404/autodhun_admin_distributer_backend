import { ReleaseArtistModel, IReleaseArtist } from './release-artist.model';
import { ReleaseLabelModel, IReleaseLabel } from './release-label.model';
import { ReleaseLanguageModel, IReleaseLanguage } from './release-language.model';
import { ReleaseGenreModel, IReleaseGenre } from './release-genre.model';
import { LABEL_STATUS, type LabelStatus } from './release-catalog.constants';
import { ApiError } from '@/utils/ApiError';
import { ensureLabelOwnershipBackfill, type LabelAccessActor } from '@/utils/labelOwnership';
import {
  assertOwnedByAccess,
  buildOwnedByScope,
  canManagePlatformWorkflow,
  type ScopeActor,
} from '@/utils/dataScope';
import {
  CatalogListQueryDto,
  CreateCatalogNameDto,
  LabelManageQueryDto,
  UpdateLabelDto,
  UpdateLabelStatusDto,
} from './release-catalog.validator';
import { PaginatedResult } from '@/types';
import { labelUpdateService } from '@/modules/label-update/label-update.service';

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

interface CatalogActor extends LabelAccessActor {
  roleSlug: string;
}

interface ManageActor extends LabelAccessActor {
  roleSlug: string;
}

function toScopeActor(actor: ManageActor): ScopeActor {
  return {
    id: actor.id,
    roleSlug: actor.roleSlug,
    isSuperAdmin: actor.isSuperAdmin,
    isSubAdmin: Boolean(actor.isSubAdmin),
  };
}

let statusBackfillPromise: Promise<void> | null = null;
let artistIndexPromise: Promise<void> | null = null;

/** Drops legacy global unique name index so artist catalogs are per-owner. */
async function ensureArtistOwnerIndexes(): Promise<void> {
  if (!artistIndexPromise) {
    artistIndexPromise = (async () => {
      try {
        await ReleaseArtistModel.collection.dropIndex('normalizedName_1');
      } catch {
        // Index already removed or never existed.
      }
      await ReleaseArtistModel.syncIndexes();
    })();
  }
  await artistIndexPromise;
}

async function ensureLabelStatusBackfill(): Promise<void> {
  if (!statusBackfillPromise) {
    statusBackfillPromise = ReleaseLabelModel.updateMany(
      { $or: [{ status: { $exists: false } }, { status: null }] },
      { $set: { status: LABEL_STATUS.ACTIVE } },
    ).then(() => undefined);
  }
  await statusBackfillPromise;
}

async function listArtists(query: CatalogListQueryDto, actor: CatalogActor): Promise<IReleaseArtist[]> {
  await ensureArtistOwnerIndexes();

  /** Form dropdowns are owner-only — each account only sees artists they created. */
  const filter: Record<string, unknown> = { createdBy: actor.id };
  if (query.search?.trim()) {
    filter.name = { $regex: query.search.trim(), $options: 'i' };
  }
  return ReleaseArtistModel.find(filter).sort({ name: 1 }).limit(query.limit).exec();
}

async function listLanguages(query: CatalogListQueryDto): Promise<IReleaseLanguage[]> {
  const filter: Record<string, unknown> = {};
  if (query.search?.trim()) {
    filter.name = { $regex: query.search.trim(), $options: 'i' };
  }
  return ReleaseLanguageModel.find(filter).sort({ sortOrder: 1, name: 1 }).limit(query.limit).exec();
}

async function listGenres(query: CatalogListQueryDto): Promise<IReleaseGenre[]> {
  const filter: Record<string, unknown> = {};
  if (query.search?.trim()) {
    filter.name = { $regex: query.search.trim(), $options: 'i' };
  }
  return ReleaseGenreModel.find(filter).sort({ sortOrder: 1, name: 1 }).limit(query.limit).exec();
}

async function listLabels(query: CatalogListQueryDto, actor: CatalogActor): Promise<IReleaseLabel[]> {
  await ensureLabelOwnershipBackfill();
  await ensureLabelStatusBackfill();

  /**
   * Super Admin → all active labels (for Issues assign forms).
   * Sub Admin → labels owned by self + invited Admins.
   * Admin → only own labels (create-release / claims forms).
   */
  const ownedByScope = await buildOwnedByScope(toScopeActor(actor));
  const filter: Record<string, unknown> = {
    status: LABEL_STATUS.ACTIVE,
    ...ownedByScope,
  };

  if (query.search?.trim()) {
    filter.name = { $regex: query.search.trim(), $options: 'i' };
  }

  return ReleaseLabelModel.find(filter).sort({ name: 1 }).limit(query.limit).exec();
}

async function listLabelsManage(
  query: LabelManageQueryDto,
  actor: ManageActor,
): Promise<PaginatedResult<IReleaseLabel>> {
  await ensureLabelOwnershipBackfill();
  await ensureLabelStatusBackfill();

  const ownedByScope = await buildOwnedByScope(toScopeActor(actor));
  const filter: Record<string, unknown> = { status: query.status, ...ownedByScope };

  if (query.search?.trim()) {
    filter.name = { $regex: query.search.trim(), $options: 'i' };
  }

  const [items, total] = await Promise.all([
    ReleaseLabelModel.find(filter)
      .populate('ownedBy', 'name email')
      .sort({ name: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .exec(),
    ReleaseLabelModel.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
  };
}

async function createArtist(dto: CreateCatalogNameDto, userId: string): Promise<IReleaseArtist> {
  await ensureArtistOwnerIndexes();

  const name = dto.name.trim();
  const normalizedName = normalizeName(name);
  const existing = await ReleaseArtistModel.findOne({ createdBy: userId, normalizedName }).exec();
  if (existing) throw ApiError.conflict('An artist with this name already exists in your catalog');

  try {
    return await ReleaseArtistModel.create({ name, normalizedName, createdBy: userId });
  } catch {
    const duplicate = await ReleaseArtistModel.findOne({ createdBy: userId, normalizedName }).exec();
    if (duplicate) throw ApiError.conflict('An artist with this name already exists in your catalog');
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
      status: LABEL_STATUS.ACTIVE,
      createdBy: userId,
      ownedBy: userId,
    });
  } catch {
    const duplicate = await ReleaseLabelModel.findOne({ normalizedName }).exec();
    if (duplicate) throw ApiError.conflict('A label with this name already exists');
    throw ApiError.badRequest('Could not create label');
  }
}

async function updateLabel(id: string, dto: UpdateLabelDto, actor: ManageActor): Promise<IReleaseLabel> {
  await ensureLabelStatusBackfill();

  const label = await ReleaseLabelModel.findById(id).exec();
  if (!label) throw ApiError.notFound('Label not found');
  await assertOwnedByAccess(toScopeActor(actor), label.ownedBy);

  const previousName = label.name;
  const name = dto.name.trim();
  const normalizedName = normalizeName(name);
  const duplicate = await ReleaseLabelModel.findOne({
    normalizedName,
    _id: { $ne: label._id },
  }).exec();

  if (duplicate) throw ApiError.conflict('A label with this name already exists');

  label.name = name;
  label.normalizedName = normalizedName;
  await label.save();

  if (canManagePlatformWorkflow(toScopeActor(actor)) && previousName !== name) {
    await labelUpdateService.recordUpdate({
      labelId: label._id.toString(),
      previousName,
      newName: name,
      ownerId: label.ownedBy.toString(),
      updatedById: actor.id,
    });
  }

  const populated = await ReleaseLabelModel.findById(label._id).populate('ownedBy', 'name email').exec();
  return populated as IReleaseLabel;
}

async function deleteLabel(id: string, actor: ManageActor): Promise<void> {
  const label = await ReleaseLabelModel.findById(id).exec();
  if (!label) throw ApiError.notFound('Label not found');
  await assertOwnedByAccess(toScopeActor(actor), label.ownedBy);

  await ReleaseLabelModel.deleteOne({ _id: label._id });
}

async function updateLabelStatus(
  id: string,
  dto: UpdateLabelStatusDto,
  actor: ManageActor,
): Promise<IReleaseLabel> {
  await ensureLabelStatusBackfill();

  const label = await ReleaseLabelModel.findById(id).exec();
  if (!label) throw ApiError.notFound('Label not found');
  await assertOwnedByAccess(toScopeActor(actor), label.ownedBy);

  label.status = dto.status as LabelStatus;
  await label.save();

  const populated = await ReleaseLabelModel.findById(label._id).populate('ownedBy', 'name email').exec();
  return populated as IReleaseLabel;
}

export const releaseCatalogService = {
  listArtists,
  listLanguages,
  listGenres,
  listLabels,
  listLabelsManage,
  createArtist,
  createLabel,
  updateLabel,
  deleteLabel,
  updateLabelStatus,
};
