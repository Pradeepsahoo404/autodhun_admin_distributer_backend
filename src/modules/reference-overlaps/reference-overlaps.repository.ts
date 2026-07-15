import { BaseRepository } from '@/repositories/base.repository';
import { IReferenceOverlap, ReferenceOverlapModel } from './reference-overlaps.model';
import { PaginatedResult } from '@/types';
import { ListQueryDto } from './reference-overlaps.validator';

export interface ReferenceOverlapListFilter {
  search?: string;
  status?: string;
  ownership?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildFilter(
  params: ReferenceOverlapListFilter,
  scope: Record<string, unknown> = {},
): Record<string, unknown> {
  const filter: Record<string, unknown> = { ...scope };

  if (params.search) {
    const searchOr = [
      { otherParty: { $regex: params.search, $options: 'i' } },
      { assetName: { $regex: params.search, $options: 'i' } },
      { overlappingAssetName: { $regex: params.search, $options: 'i' } },
      { labelName: { $regex: params.search, $options: 'i' } },
      { isrcCode: { $regex: params.search, $options: 'i' } },
    ];

    if (filter.$or) {
      const scopeOr = filter.$or;
      delete filter.$or;
      filter.$and = [{ $or: scopeOr }, { $or: searchOr }];
    } else {
      filter.$or = searchOr;
    }
  }

  if (params.status) {
    filter.status = params.status;
  }

  if (params.ownership !== undefined) {
    filter.ownership = params.ownership;
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

class ReferenceOverlapsRepository extends BaseRepository<IReferenceOverlap> {
  constructor() {
    super(ReferenceOverlapModel);
  }

  findByIdPopulated(id: string): Promise<IReferenceOverlap | null> {
    return ReferenceOverlapModel.findById(id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();
  }

  async paginate(
    query: ListQueryDto,
    scope: Record<string, unknown>,
  ): Promise<PaginatedResult<IReferenceOverlap>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter = buildFilter(
      {
        search: query.search,
        status: query.status,
        ownership: query.ownership,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
      scope,
    );

    const [items, total] = await Promise.all([
      ReferenceOverlapModel.find(filter)
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      ReferenceOverlapModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findForExport(
    scope: Record<string, unknown>,
    params: ReferenceOverlapListFilter = {},
  ): Promise<IReferenceOverlap[]> {
    const filter = buildFilter(params, scope);
    return ReferenceOverlapModel.find(filter)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }
}

export const referenceOverlapsRepository = new ReferenceOverlapsRepository();
