import { BaseRepository } from '@/repositories/base.repository';
import { IMusicRelease, MusicReleaseModel } from './music-release.model';
import { PaginatedResult } from '@/types';
import { ListMusicReleasesQueryDto } from './music-release.validator';
import { MUSIC_RELEASE_STATUS } from './music-release.constants';

export interface MusicReleaseListScope {
  createdBy?: string;
  status?: string | { $ne?: string; $eq?: string; $in?: string[]; $nin?: string[] };
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

function resolveScopedStatus(
  scopeStatus: MusicReleaseListScope['status'],
  queryStatus?: string,
): MusicReleaseListScope['status'] | { $in: [] } {
  if (!queryStatus) return scopeStatus;

  if (!scopeStatus) return queryStatus;

  if (typeof scopeStatus === 'string') {
    return scopeStatus === queryStatus ? queryStatus : { $in: [] };
  }

  if (scopeStatus.$in) {
    return scopeStatus.$in.includes(queryStatus) ? queryStatus : { $in: [] };
  }

  if (scopeStatus.$ne) {
    return queryStatus === scopeStatus.$ne ? { $in: [] } : queryStatus;
  }

  if (scopeStatus.$eq) {
    return scopeStatus.$eq === queryStatus ? queryStatus : { $in: [] };
  }

  return queryStatus;
}

function buildFilter(scope: MusicReleaseListScope, queryStatus?: string): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (scope.createdBy) filter.createdBy = scope.createdBy;

  const status = resolveScopedStatus(scope.status, queryStatus);
  if (status) filter.status = status;

  if (scope.search) {
    filter.$or = [
      { title: { $regex: scope.search, $options: 'i' } },
      { artist: { $regex: scope.search, $options: 'i' } },
      { label: { $regex: scope.search, $options: 'i' } },
      { upc: { $regex: scope.search, $options: 'i' } },
    ];
  }

  if (scope.dateFrom || scope.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (scope.dateFrom) {
      createdAt.$gte = new Date(`${scope.dateFrom}T00:00:00.000Z`);
    }
    if (scope.dateTo) {
      createdAt.$lte = new Date(`${scope.dateTo}T23:59:59.999Z`);
    }
    filter.createdAt = createdAt;
  }

  return filter;
}

class MusicReleaseRepository extends BaseRepository<IMusicRelease> {
  constructor() {
    super(MusicReleaseModel);
  }

  findByIdPopulated(id: string): Promise<IMusicRelease | null> {
    return MusicReleaseModel.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();
  }

  findByIdsPopulated(ids: string[]): Promise<IMusicRelease[]> {
    return MusicReleaseModel.find({ _id: { $in: ids } })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();
  }

  async paginate(
    query: ListMusicReleasesQueryDto,
    scope: MusicReleaseListScope,
  ): Promise<PaginatedResult<IMusicRelease>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter = buildFilter(
      {
        ...scope,
        search: query.search,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
      query.status,
    );

    const [items, total] = await Promise.all([
      MusicReleaseModel.find(filter)
        .populate('createdBy', 'name email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      MusicReleaseModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findForExport(scope: MusicReleaseListScope): Promise<IMusicRelease[]> {
    const filter = buildFilter(scope);
    return MusicReleaseModel.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatusByIds(
    ids: string[],
    status: string,
    updatedBy: string,
    correctionReasons: string[] = [],
  ): Promise<number> {
    const update: Record<string, unknown> = { status, updatedBy };
    if (status === MUSIC_RELEASE_STATUS.CORRECTION) {
      update.correctionReasons = correctionReasons;
    } else {
      update.correctionReasons = [];
    }

    const result = await MusicReleaseModel.updateMany({ _id: { $in: ids } }, update).exec();
    return result.modifiedCount;
  }
}

export const musicReleaseRepository = new MusicReleaseRepository();

export { MUSIC_RELEASE_STATUS };
