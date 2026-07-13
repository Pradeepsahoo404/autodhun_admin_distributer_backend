import { BaseRepository } from '@/repositories/base.repository';
import { ISupportTicket, SupportTicketModel } from './support-ticket.model';
import { PaginatedResult } from '@/types';
import { ListSupportTicketsQueryDto } from './support-ticket.validator';
import {
  SUPPORT_TICKET_CASE_FILTER,
  SUPPORT_TICKET_STATUS,
} from './support-ticket.constants';

export interface SupportTicketListScope {
  createdBy?: string;
  search?: string;
  caseFilter?: string;
}

function buildFilter(params: SupportTicketListScope): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (params.createdBy) {
    filter.createdBy = params.createdBy;
  }

  if (params.search) {
    const search = params.search.trim();
    const ticketNumber = Number.parseInt(search.replace(/^#/, ''), 10);
    const orConditions: Record<string, unknown>[] = [
      { subject: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
    if (!Number.isNaN(ticketNumber)) {
      orConditions.push({ ticketNumber });
    }
    filter.$or = orConditions;
  }

  if (params.caseFilter === SUPPORT_TICKET_CASE_FILTER.OPEN) {
    filter.status = { $in: [SUPPORT_TICKET_STATUS.IN_PROGRESS, SUPPORT_TICKET_STATUS.OPEN] };
  } else if (params.caseFilter === SUPPORT_TICKET_CASE_FILTER.RESOLVED) {
    filter.status = { $in: [SUPPORT_TICKET_STATUS.RESOLVED, SUPPORT_TICKET_STATUS.CLOSED] };
  }

  return filter;
}

class SupportTicketRepository extends BaseRepository<ISupportTicket> {
  constructor() {
    super(SupportTicketModel);
  }

  async getRandomTicketNumber(): Promise<number> {
    const min = 79000;
    const max = 99999;

    for (let attempt = 0; attempt < 25; attempt++) {
      const candidate = Math.floor(Math.random() * (max - min + 1)) + min;
      const exists = await SupportTicketModel.exists({ ticketNumber: candidate }).exec();
      if (!exists) return candidate;
    }

    throw new Error('Unable to generate a unique ticket number');
  }

  findByIdPopulated(id: string): Promise<ISupportTicket | null> {
    return SupportTicketModel.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();
  }

  async paginate(
    query: ListSupportTicketsQueryDto,
    scope: SupportTicketListScope,
  ): Promise<PaginatedResult<ISupportTicket>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter = buildFilter({
      ...scope,
      search: query.search,
      caseFilter: query.caseFilter,
    });

    const [items, total] = await Promise.all([
      SupportTicketModel.find(filter)
        .populate('createdBy', 'name email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      SupportTicketModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async closeExpiredResolvedTickets(cutoff: Date): Promise<number> {
    const result = await SupportTicketModel.updateMany(
      {
        status: SUPPORT_TICKET_STATUS.RESOLVED,
        resolvedAt: { $ne: null, $lte: cutoff },
      },
      {
        $set: { status: SUPPORT_TICKET_STATUS.CLOSED },
      },
    ).exec();
    return result.modifiedCount;
  }
}

export const supportTicketRepository = new SupportTicketRepository();
