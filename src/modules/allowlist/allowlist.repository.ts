import { BaseRepository } from '@/repositories/base.repository';
import { IAllowlist, AllowlistModel } from './allowlist.model';
import { PaginatedResult } from '@/types';
import { ListQueryDto } from './allowlist.validator';

export interface AllowlistListFilter {
  createdBy?: string;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildFilter(params: AllowlistListFilter): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (params.createdBy) {
    filter.createdBy = params.createdBy;
  }

  if (params.search) {
    filter.$or = [
      { labelName: { $regex: params.search, $options: 'i' } },
      { channelLink: { $regex: params.search, $options: 'i' } },
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

class AllowlistRepository extends BaseRepository<IAllowlist> {
  constructor() {
    super(AllowlistModel);
  }

  findByIdPopulated(id: string): Promise<IAllowlist | null> {
    return AllowlistModel.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();
  }

  async paginate(
    query: ListQueryDto,
    scope: AllowlistListFilter,
  ): Promise<PaginatedResult<IAllowlist>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter = buildFilter({
      ...scope,
      search: query.search,
      status: query.status,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const [items, total] = await Promise.all([
      AllowlistModel.find(filter)
        .populate('createdBy', 'name email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      AllowlistModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findForExport(scope: AllowlistListFilter): Promise<IAllowlist[]> {
    const filter = buildFilter(scope);
    return AllowlistModel.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }
}

export const allowlistRepository = new AllowlistRepository();
