import { BaseRepository } from '@/repositories/base.repository';
import {
  IYoutubeClaimRelease,
  YoutubeClaimReleaseModel,
} from './youtube-claim-release.model';
import { PaginatedResult } from '@/types';
import { ListQueryDto } from './youtube-claim-release.validator';

export interface ClaimReleaseListFilter {
  createdBy?: string;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildFilter(params: ClaimReleaseListFilter): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (params.createdBy) {
    filter.createdBy = params.createdBy;
  }

  if (params.search) {
    filter.$or = [
      { senderLabelName: { $regex: params.search, $options: 'i' } },
      { receiverLabelName: { $regex: params.search, $options: 'i' } },
      { isrcCode: { $regex: params.search, $options: 'i' } },
      { youtubeLink: { $regex: params.search, $options: 'i' } },
    ];
  }

  if (params.status) {
    filter.status = params.status;
  }

  if (params.dateFrom || params.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (params.dateFrom) {
      createdAt.$gte = new Date(`${params.dateFrom}T00:00:00.000Z`);
    }
    if (params.dateTo) {
      createdAt.$lte = new Date(`${params.dateTo}T23:59:59.999Z`);
    }
    filter.createdAt = createdAt;
  }

  return filter;
}

class YoutubeClaimReleaseRepository extends BaseRepository<IYoutubeClaimRelease> {
  constructor() {
    super(YoutubeClaimReleaseModel);
  }

  findByIdPopulated(id: string): Promise<IYoutubeClaimRelease | null> {
    return YoutubeClaimReleaseModel.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();
  }

  async paginate(
    query: ListQueryDto,
    scope: ClaimReleaseListFilter,
  ): Promise<PaginatedResult<IYoutubeClaimRelease>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter = buildFilter({
      ...scope,
      search: query.search,
      status: query.status,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const [items, total] = await Promise.all([
      YoutubeClaimReleaseModel.find(filter)
        .populate('createdBy', 'name email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      YoutubeClaimReleaseModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findForExport(scope: ClaimReleaseListFilter): Promise<IYoutubeClaimRelease[]> {
    const filter = buildFilter(scope);
    return YoutubeClaimReleaseModel.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }
}

export const youtubeClaimReleaseRepository = new YoutubeClaimReleaseRepository();
