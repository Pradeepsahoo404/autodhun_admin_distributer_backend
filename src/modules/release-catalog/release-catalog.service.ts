import { ReleaseArtistModel, IReleaseArtist } from './release-artist.model';
import { ReleaseLabelModel, IReleaseLabel } from './release-label.model';
import { LABEL_STATUS, type LabelStatus } from './release-catalog.constants';
import { ApiError } from '@/utils/ApiError';
import { ensureLabelOwnershipBackfill, type LabelAccessActor } from '@/utils/labelOwnership';
import {
  CatalogListQueryDto,
  CreateCatalogNameDto,
  LabelManageQueryDto,
  UpdateLabelDto,
  UpdateLabelStatusDto,
} from './release-catalog.validator';
import { PaginatedResult } from '@/types';

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

interface CatalogActor extends LabelAccessActor {}

interface ManageActor extends LabelAccessActor {}

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

async function listArtists(query: CatalogListQueryDto): Promise<IReleaseArtist[]> {
  const filter: Record<string, unknown> = {};
  if (query.search?.trim()) {
    filter.name = { $regex: query.search.trim(), $options: 'i' };
  }
  return ReleaseArtistModel.find(filter).sort({ name: 1 }).limit(query.limit).exec();
}

async function listLabels(query: CatalogListQueryDto, actor: CatalogActor): Promise<IReleaseLabel[]> {
  await ensureLabelOwnershipBackfill();
  await ensureLabelStatusBackfill();

  const filter: Record<string, unknown> = {
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
  _actor: ManageActor,
): Promise<PaginatedResult<IReleaseLabel>> {
  await ensureLabelOwnershipBackfill();
  await ensureLabelStatusBackfill();

  const filter: Record<string, unknown> = { status: query.status };

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
  const name = dto.name.trim();
  const normalizedName = normalizeName(name);
  const existing = await ReleaseArtistModel.findOne({ normalizedName }).exec();
  if (existing) throw ApiError.conflict('An artist with this name already exists');

  try {
    return await ReleaseArtistModel.create({ name, normalizedName, createdBy: userId });
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

async function updateLabel(id: string, dto: UpdateLabelDto, _actor: ManageActor): Promise<IReleaseLabel> {
  await ensureLabelStatusBackfill();

  const label = await ReleaseLabelModel.findById(id).exec();
  if (!label) throw ApiError.notFound('Label not found');

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
  listLabels,
  listLabelsManage,
  createArtist,
  createLabel,
  updateLabel,
  deleteLabel,
  updateLabelStatus,
};
