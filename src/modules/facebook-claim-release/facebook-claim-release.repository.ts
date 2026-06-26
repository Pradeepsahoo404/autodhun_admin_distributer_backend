import { BaseRepository } from '@/repositories/base.repository';
import {
  IFacebookClaimRelease,
  FacebookClaimReleaseModel,
} from './facebook-claim-release.model';
import { PaginatedResult } from '@/types';
import { ListQueryDto } from './facebook-claim-release.validator';

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
      { facebookPageLink: { $regex: params.search, $options: 'i' } },
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

class FacebookClaimReleaseRepository extends BaseRepository<IFacebookClaimRelease> {
  constructor() {
    super(FacebookClaimReleaseModel);
  }

  findByIdPopulated(id: string): Promise<IFacebookClaimRelease | null> {
    return FacebookClaimReleaseModel.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();
  }

  async paginate(
    query: ListQueryDto,
    scope: ClaimReleaseListFilter,
  ): Promise<PaginatedResult<IFacebookClaimRelease>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter = buildFilter({
      ...scope,
      search: query.search,
      status: query.status,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const [items, total] = await Promise.all([
      FacebookClaimReleaseModel.find(filter)
        .populate('createdBy', 'name email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      FacebookClaimReleaseModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findForExport(scope: ClaimReleaseListFilter): Promise<IFacebookClaimRelease[]> {
    const filter = buildFilter(scope);
    return FacebookClaimReleaseModel.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }
}

export const facebookClaimReleaseRepository = new FacebookClaimReleaseRepository();
