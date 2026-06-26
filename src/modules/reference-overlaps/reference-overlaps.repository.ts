import { BaseRepository } from '@/repositories/base.repository';
import { IReferenceOverlap, ReferenceOverlapModel } from './reference-overlaps.model';
import { PaginatedResult } from '@/types';
import { ListQueryDto } from './reference-overlaps.validator';

export interface ReferenceOverlapListFilter {
  assignedTo?: string;
  search?: string;
  status?: string;
  ownership?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildFilter(params: ReferenceOverlapListFilter): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (params.assignedTo) {
    filter.assignedTo = params.assignedTo;
  }

  if (params.search) {
    filter.$or = [
      { otherParty: { $regex: params.search, $options: 'i' } },
      { assetName: { $regex: params.search, $options: 'i' } },
      { overlappingAssetName: { $regex: params.search, $options: 'i' } },
      { labelName: { $regex: params.search, $options: 'i' } },
      { isrcCode: { $regex: params.search, $options: 'i' } },
    ];
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
    scope: ReferenceOverlapListFilter,
  ): Promise<PaginatedResult<IReferenceOverlap>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter = buildFilter({
      ...scope,
      search: query.search,
      status: query.status,
      ownership: query.ownership,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

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

  findForExport(scope: ReferenceOverlapListFilter): Promise<IReferenceOverlap[]> {
    const filter = buildFilter(scope);
    return ReferenceOverlapModel.find(filter)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }
}

export const referenceOverlapsRepository = new ReferenceOverlapsRepository();
