import { supportTicketRepository } from './support-ticket.repository';
import { ApiError } from '@/utils/ApiError';
import { ISupportTicket } from './support-ticket.model';
import { PaginatedResult } from '@/types';
import {
  CreateSupportTicketDto,
  ListSupportTicketsQueryDto,
  UpdateSupportTicketDto,
  UpdateSupportTicketStatusDto,
} from './support-ticket.validator';
import {
  SUPPORT_TICKET_STATUS,
  buildSupportTicketSubject,
  isValidSupportTicketIssueTypeForCategory,
  type SupportTicketCategory,
  type SupportTicketIssueType,
} from './support-ticket.constants';
import { supportTicketNotificationsService } from '@/modules/notification/support-ticket-notifications.service';
import {
  buildCreatedByScope,
  assertCreatedByAccess,
  canManagePlatformWorkflow,
  type ScopeActor,
} from '@/utils/dataScope';

interface Actor {
  id: string;
  isSuperAdmin: boolean;
  isSubAdmin: boolean;
  roleSlug: string;
  name?: string;
}

function buildTicketSummary(item: ISupportTicket): Record<string, string> {
  return {
    ticketNumber: String(item.ticketNumber),
    subject: item.subject,
    category: item.category,
    issueType: item.issueType,
    status: item.status,
  };
}

async function assertOwnership(item: ISupportTicket, actor: Actor): Promise<void> {
  await assertCreatedByAccess(actor as ScopeActor, item.createdBy);
}

async function assertAdminCanModifyContent(item: ISupportTicket, actor: Actor): Promise<void> {
  if (canManagePlatformWorkflow(actor as ScopeActor)) {
    await assertOwnership(item, actor);
    return;
  }
  await assertOwnership(item, actor);
  if (item.status !== SUPPORT_TICKET_STATUS.IN_PROGRESS) {
    throw ApiError.forbidden('You can only edit tickets that are still in process');
  }
}

async function assertAdminCanDelete(item: ISupportTicket, actor: Actor): Promise<void> {
  if (canManagePlatformWorkflow(actor as ScopeActor)) {
    await assertOwnership(item, actor);
    return;
  }
  await assertOwnership(item, actor);
  if (item.status !== SUPPORT_TICKET_STATUS.IN_PROGRESS) {
    throw ApiError.forbidden('You can only delete tickets that are still in process');
  }
}

class SupportTicketService {
  private async scope(actor: Actor) {
    return buildCreatedByScope(actor as ScopeActor);
  }

  async list(
    query: ListSupportTicketsQueryDto,
    actor: Actor,
  ): Promise<PaginatedResult<ISupportTicket>> {
    return supportTicketRepository.paginate(query, await this.scope(actor));
  }

  async getById(id: string, actor: Actor): Promise<ISupportTicket> {
    const item = await supportTicketRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Support ticket not found');
    await assertOwnership(item, actor);
    return item;
  }

  async create(dto: CreateSupportTicketDto, actor: Actor): Promise<ISupportTicket> {
    if (actor.isSuperAdmin) {
      throw ApiError.forbidden('Super Admin cannot create support tickets');
    }

    const ticketNumber = await supportTicketRepository.getRandomTicketNumber();
    const created = await supportTicketRepository.create({
      ...dto,
      subject: buildSupportTicketSubject(dto.issueType),
      ticketNumber,
      status: SUPPORT_TICKET_STATUS.IN_PROGRESS,
      createdBy: actor.id as never,
      updatedBy: actor.id as never,
    });
    const populated = await supportTicketRepository.findByIdPopulated(created._id.toString());
    const result = populated as ISupportTicket;

    if (!actor.isSuperAdmin) {
      await supportTicketNotificationsService.notifyTicketCreated(result, actor);
    }

    return result;
  }

  async update(id: string, dto: UpdateSupportTicketDto, actor: Actor): Promise<ISupportTicket> {
    const item = await supportTicketRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Support ticket not found');
    await assertAdminCanModifyContent(item, actor);

    const nextCategory = (dto.category ?? item.category) as SupportTicketCategory;
    const nextIssueType = (dto.issueType ?? item.issueType) as SupportTicketIssueType;

    if (!isValidSupportTicketIssueTypeForCategory(nextCategory, nextIssueType)) {
      throw ApiError.badRequest('Issue type does not match the selected category');
    }

    const updatePayload: Record<string, unknown> = {
      ...dto,
      category: nextCategory,
      issueType: nextIssueType,
      subject: buildSupportTicketSubject(nextIssueType),
      updatedBy: actor.id as never,
    };

    await supportTicketRepository.updateById(id, updatePayload);

    const populated = await supportTicketRepository.findByIdPopulated(id);
    return populated as ISupportTicket;
  }

  async updateStatus(
    id: string,
    dto: UpdateSupportTicketStatusDto,
    actor: Actor,
  ): Promise<ISupportTicket> {
    if (!canManagePlatformWorkflow(actor as ScopeActor)) {
      throw ApiError.forbidden('Only Super Admin or Sub Admin can update ticket status');
    }

    const item = await supportTicketRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Support ticket not found');
    await assertOwnership(item, actor);

    const previousStatus = item.status;
    const updatePayload: Record<string, unknown> = {
      status: dto.status,
      updatedBy: actor.id as never,
    };

    if (dto.resolutionNote !== undefined) {
      updatePayload.resolutionNote = dto.resolutionNote;
    }

    if (dto.status === SUPPORT_TICKET_STATUS.RESOLVED) {
      updatePayload.resolvedAt = new Date();
    } else if (dto.status === SUPPORT_TICKET_STATUS.OPEN) {
      updatePayload.resolvedAt = null;
    }

    await supportTicketRepository.updateById(id, updatePayload);

    const populated = await supportTicketRepository.findByIdPopulated(id);
    const result = populated as ISupportTicket;

    if (previousStatus !== dto.status) {
      await supportTicketNotificationsService.notifyTicketStatusUpdated(
        result,
        dto.status,
        actor,
        buildTicketSummary(result),
        dto.resolutionNote,
      );
    }

    return result;
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const item = await supportTicketRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Support ticket not found');

    if (actor.isSuperAdmin) {
      await supportTicketRepository.deleteById(id);
      return;
    }

    await assertAdminCanDelete(item, actor);
    await supportTicketRepository.deleteById(id);
  }
}

export const supportTicketService = new SupportTicketService();
