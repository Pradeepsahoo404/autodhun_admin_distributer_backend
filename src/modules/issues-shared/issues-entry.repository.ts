import { BaseRepository } from '@/repositories/base.repository';
import { Model } from 'mongoose';
import { IIssuesEntry } from './issues-entry.model';
import { PaginatedResult } from '@/types';
import { IssuesEntryListQueryDto } from './issues-entry.validator';

export interface IssuesEntryListFilter {
  assignedTo?: string;
  search?: string;
  status?: string;
  ownership?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildFilter(params: IssuesEntryListFilter): Record<string, unknown> {
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

export class IssuesEntryRepository extends BaseRepository<IIssuesEntry> {
  constructor(private readonly issuesModel: Model<IIssuesEntry>) {
    super(issuesModel);
  }

  findByIdPopulated(id: string): Promise<IIssuesEntry | null> {
    return this.issuesModel
      .findById(id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();
  }

  async paginate(
    query: IssuesEntryListQueryDto,
    scope: IssuesEntryListFilter,
  ): Promise<PaginatedResult<IIssuesEntry>> {
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
      this.issuesModel
        .find(filter)
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.issuesModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findForExport(scope: IssuesEntryListFilter): Promise<IIssuesEntry[]> {
    const filter = buildFilter(scope);
    return this.issuesModel
      .find(filter)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }
}
