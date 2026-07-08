import { BaseRepository } from '@/repositories/base.repository';
import { IChannel, ChannelModel } from './channel.model';
import { PaginatedResult } from '@/types';
import { ListQueryDto } from './channel.validator';

export interface ChannelListFilter {
  createdBy?: string;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildFilter(params: ChannelListFilter): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (params.createdBy) {
    filter.createdBy = params.createdBy;
  }

  if (params.search) {
    filter.$or = [
      { channelName: { $regex: params.search, $options: 'i' } },
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

class ChannelRepository extends BaseRepository<IChannel> {
  constructor() {
    super(ChannelModel);
  }

  findByIdPopulated(id: string): Promise<IChannel | null> {
    return ChannelModel.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();
  }

  async paginate(
    query: ListQueryDto,
    scope: ChannelListFilter,
  ): Promise<PaginatedResult<IChannel>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter = buildFilter({
      ...scope,
      search: query.search,
      status: query.status,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const [items, total] = await Promise.all([
      ChannelModel.find(filter)
        .populate('createdBy', 'name email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      ChannelModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findForExport(scope: ChannelListFilter): Promise<IChannel[]> {
    const filter = buildFilter(scope);
    return ChannelModel.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }
}

export const channelRepository = new ChannelRepository();
