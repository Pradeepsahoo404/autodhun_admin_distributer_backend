import { ReleaseArtistModel, IReleaseArtist } from './release-artist.model';
import { ReleaseLabelModel, IReleaseLabel } from './release-label.model';
import { ReleaseLanguageModel, IReleaseLanguage } from './release-language.model';
import { ReleaseGenreModel, IReleaseGenre } from './release-genre.model';
import { LABEL_STATUS, type LabelStatus } from './release-catalog.constants';
import { ApiError } from '@/utils/ApiError';
import { ensureLabelOwnershipBackfill, type LabelAccessActor } from '@/utils/labelOwnership';
import {
  requireWriteTenantId,
  tenantScopeFilter,
  type TenantActor,
} from '@/utils/tenantScope';
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

type CatalogActor = LabelAccessActor & Pick<TenantActor, 'tenantId' | 'isMasterAdmin' | 'role'>;
type ManageActor = CatalogActor;

let statusBackfillPromise: Promise<void> | null = null;

async function ensureLabelStatusBackfill(): Promise<void> {
  if (!statusBackfillPromise) {
    statusBackfillPromise = ReleaseLabelModel.updateMany(
      { $or: [{ status: { $exists: false } }, { status: null }] },
      { $set: { status: LABEL_STATUS.ACTIVE } },
    ).then(() => undefined);
  }
  await statusBackfillPromise;
}

async function listArtists(
  query: CatalogListQueryDto,
  actor?: CatalogActor,
): Promise<IReleaseArtist[]> {
  const filter: Record<string, unknown> = actor
    ? { ...tenantScopeFilter(actor as TenantActor) }
    : {};
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

  const filter: Record<string, unknown> = {
    ...tenantScopeFilter(actor as TenantActor),
    ownedBy: actor.id,
    status: LABEL_STATUS.ACTIVE,
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

  const filter: Record<string, unknown> = {
    ...tenantScopeFilter(actor as TenantActor),
    status: query.status,
  };

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

async function createArtist(dto: CreateCatalogNameDto, actor: CatalogActor): Promise<IReleaseArtist> {
  const name = dto.name.trim();
  const normalizedName = normalizeName(name);
  const tenantId = requireWriteTenantId(actor as TenantActor);
  const existing = await ReleaseArtistModel.findOne({ normalizedName, tenantId }).exec();
  if (existing) throw ApiError.conflict('An artist with this name already exists');

  try {
    return await ReleaseArtistModel.create({
      name,
      normalizedName,
      tenantId,
      createdBy: actor.id,
    });
  } catch {
    const duplicate = await ReleaseArtistModel.findOne({ normalizedName, tenantId }).exec();
    if (duplicate) throw ApiError.conflict('An artist with this name already exists');
    throw ApiError.badRequest('Could not create artist');
  }
}

async function createLabel(dto: CreateCatalogNameDto, actor: CatalogActor): Promise<IReleaseLabel> {
  const name = dto.name.trim();
  const normalizedName = normalizeName(name);
  const tenantId = requireWriteTenantId(actor as TenantActor);
  const existing = await ReleaseLabelModel.findOne({ normalizedName, tenantId }).exec();
  if (existing) throw ApiError.conflict('A label with this name already exists');

  try {
    return await ReleaseLabelModel.create({
      name,
      normalizedName,
      status: LABEL_STATUS.ACTIVE,
      tenantId,
      createdBy: actor.id,
      ownedBy: actor.id,
    });
  } catch {
    const duplicate = await ReleaseLabelModel.findOne({ normalizedName, tenantId }).exec();
    if (duplicate) throw ApiError.conflict('A label with this name already exists');
    throw ApiError.badRequest('Could not create label');
  }
}

async function updateLabel(id: string, dto: UpdateLabelDto, actor: ManageActor): Promise<IReleaseLabel> {
  await ensureLabelStatusBackfill();

  const label = await ReleaseLabelModel.findById(id).exec();
  if (!label) throw ApiError.notFound('Label not found');

  const previousName = label.name;
  const name = dto.name.trim();
  const normalizedName = normalizeName(name);
  const tenantId = label.tenantId ?? requireWriteTenantId(actor as TenantActor);
  const duplicate = await ReleaseLabelModel.findOne({
    normalizedName,
    tenantId,
    _id: { $ne: label._id },
  }).exec();

  if (duplicate) throw ApiError.conflict('A label with this name already exists');

  label.name = name;
  label.normalizedName = normalizedName;
  await label.save();

  if (actor.isSuperAdmin && previousName !== name) {
    await labelUpdateService.recordUpdate({
      labelId: label._id.toString(),
      previousName,
      newName: name,
      ownerId: label.ownedBy.toString(),
      updatedById: actor.id,
      tenantId: label.tenantId ? String(label.tenantId) : null,
    });
  }

  const populated = await ReleaseLabelModel.findById(label._id).populate('ownedBy', 'name email').exec();
  return populated as IReleaseLabel;
}

async function deleteLabel(id: string, _actor: ManageActor): Promise<void> {
  const label = await ReleaseLabelModel.findById(id).exec();
  if (!label) throw ApiError.notFound('Label not found');

  await ReleaseLabelModel.deleteOne({ _id: label._id });
}

async function updateLabelStatus(
  id: string,
  dto: UpdateLabelStatusDto,
  _actor: ManageActor,
): Promise<IReleaseLabel> {
  await ensureLabelStatusBackfill();

  const label = await ReleaseLabelModel.findById(id).exec();
  if (!label) throw ApiError.notFound('Label not found');

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
