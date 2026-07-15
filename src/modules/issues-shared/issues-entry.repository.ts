import { BaseRepository } from '@/repositories/base.repository';
import { Model } from 'mongoose';
import { IIssuesEntry } from './issues-entry.model';
import { PaginatedResult } from '@/types';
import { IssuesEntryListQueryDto } from './issues-entry.validator';

export interface IssuesEntryListFilter {
  search?: string;
  status?: string;
  ownership?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildFilter(
  params: IssuesEntryListFilter,
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
    scope: Record<string, unknown>,
  ): Promise<PaginatedResult<IIssuesEntry>> {
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

  findForExport(
    scope: Record<string, unknown>,
    params: IssuesEntryListFilter = {},
  ): Promise<IIssuesEntry[]> {
    const filter = buildFilter(params, scope);
    return this.issuesModel
      .find(filter)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }
}
