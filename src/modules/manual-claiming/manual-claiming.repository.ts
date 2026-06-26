import { BaseRepository } from '@/repositories/base.repository';
import { IManualClaiming, ManualClaimingModel } from './manual-claiming.model';
import { PaginatedResult } from '@/types';
import { ListQueryDto } from './manual-claiming.validator';

export interface ManualClaimingListFilter {
  createdBy?: string;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildFilter(params: ManualClaimingListFilter): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (params.createdBy) {
    filter.createdBy = params.createdBy;
  }

  if (params.search) {
    filter.$or = [
      { labelName: { $regex: params.search, $options: 'i' } },
      { isrcCode: { $regex: params.search, $options: 'i' } },
      { originalSongLink: { $regex: params.search, $options: 'i' } },
      { songLink: { $regex: params.search, $options: 'i' } },
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

class ManualClaimingRepository extends BaseRepository<IManualClaiming> {
  constructor() {
    super(ManualClaimingModel);
  }

  findByIdPopulated(id: string): Promise<IManualClaiming | null> {
    return ManualClaimingModel.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();
  }

  async paginate(
    query: ListQueryDto,
    scope: ManualClaimingListFilter,
  ): Promise<PaginatedResult<IManualClaiming>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter = buildFilter({
      ...scope,
      search: query.search,
      status: query.status,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const [items, total] = await Promise.all([
      ManualClaimingModel.find(filter)
        .populate('createdBy', 'name email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      ManualClaimingModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findForExport(scope: ManualClaimingListFilter): Promise<IManualClaiming[]> {
    const filter = buildFilter(scope);
    return ManualClaimingModel.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }
}

export const manualClaimingRepository = new ManualClaimingRepository();
