import { BaseRepository } from '@/repositories/base.repository';
import { IOac, OacModel } from './oac.model';
import { PaginatedResult } from '@/types';
import { ListQueryDto } from './oac.validator';

export interface OacListFilter {
  createdBy?: string;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildFilter(params: OacListFilter): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (params.createdBy) {
    filter.createdBy = params.createdBy;
  }

  if (params.search) {
    filter.$or = [
      { artistChannelName: { $regex: params.search, $options: 'i' } },
      { artistChannelLink: { $regex: params.search, $options: 'i' } },
      { artistChannelTopicLink: { $regex: params.search, $options: 'i' } },
      { isrcCode: { $regex: params.search, $options: 'i' } },
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

class OacRepository extends BaseRepository<IOac> {
  constructor() {
    super(OacModel);
  }

  findByIdPopulated(id: string): Promise<IOac | null> {
    return OacModel.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();
  }

  async paginate(query: ListQueryDto, scope: OacListFilter): Promise<PaginatedResult<IOac>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter = buildFilter({
      ...scope,
      search: query.search,
      status: query.status,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const [items, total] = await Promise.all([
      OacModel.find(filter)
        .populate('createdBy', 'name email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      OacModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findForExport(scope: OacListFilter): Promise<IOac[]> {
    const filter = buildFilter(scope);
    return OacModel.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }
}

export const oacRepository = new OacRepository();
