import { BaseRepository } from '@/repositories/base.repository';
import { IProfileLinking, ProfileLinkingModel } from './profile-linking.model';
import { PaginatedResult } from '@/types';
import { ListQueryDto } from './profile-linking.validator';

export interface ProfileLinkingListFilter {
  createdBy?: string;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildFilter(params: ProfileLinkingListFilter): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (params.createdBy) {
    filter.createdBy = params.createdBy;
  }

  if (params.search) {
    filter.$or = [
      { labelName: { $regex: params.search, $options: 'i' } },
      { isrcCode: { $regex: params.search, $options: 'i' } },
      { facebookPageLink: { $regex: params.search, $options: 'i' } },
      { instagramHandleName: { $regex: params.search, $options: 'i' } },
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

class ProfileLinkingRepository extends BaseRepository<IProfileLinking> {
  constructor() {
    super(ProfileLinkingModel);
  }

  findByIdPopulated(id: string): Promise<IProfileLinking | null> {
    return ProfileLinkingModel.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();
  }

  async paginate(
    query: ListQueryDto,
    scope: ProfileLinkingListFilter,
  ): Promise<PaginatedResult<IProfileLinking>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter = buildFilter({
      ...scope,
      search: query.search,
      status: query.status,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const [items, total] = await Promise.all([
      ProfileLinkingModel.find(filter)
        .populate('createdBy', 'name email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      ProfileLinkingModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findForExport(scope: ProfileLinkingListFilter): Promise<IProfileLinking[]> {
    const filter = buildFilter(scope);
    return ProfileLinkingModel.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }
}

export const profileLinkingRepository = new ProfileLinkingRepository();
