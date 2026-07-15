import { referenceOverlapsRepository } from './reference-overlaps.repository';
import { ApiError } from '@/utils/ApiError';
import {
  IReferenceOverlap,
  REFERENCE_OVERLAP_STATUS,
} from './reference-overlaps.model';
import { PaginatedResult } from '@/types';
import {
  CreateReferenceOverlapDto,
  ExportQueryDto,
  ListQueryDto,
  UpdateOwnershipDto,
  UpdateReferenceOverlapDto,
  UpdateStatusDto,
} from './reference-overlaps.validator';
import { IUser } from '@/modules/user/user.model';
import { userRepository } from '@/modules/user/user.repository';
import { ROLES } from '@/constants';
import {
  issuesNotificationsService,
  resolveUserId,
} from '@/modules/notification/issues-notifications.service';
import {
  buildAssignedToScope,
  canManagePlatformWorkflow,
  getScopeUserIds,
  resolveOwnerId,
  type ScopeActor,
} from '@/utils/dataScope';

interface Actor {
  id: string;
  isSuperAdmin: boolean;
  isSubAdmin: boolean;
  roleSlug: string;
  name?: string;
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function formatOwnership(value: string): string {
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  return 'Pending';
}

function assertPlatformWorkflow(actor: Actor, message: string): void {
  if (!canManagePlatformWorkflow(actor as ScopeActor)) {
    throw ApiError.forbidden(message);
  }
}

function assertAssignedAdmin(item: IReferenceOverlap, actor: Actor): void {
  const assignedId = resolveUserId(item.assignedTo);
  if (!assignedId || assignedId !== actor.id) {
    throw ApiError.forbidden('You can only update entries assigned to you');
  }
}

async function assertAdminUser(userId: string, actor?: Actor): Promise<void> {
  const user = await userRepository.findByIdWithRole(userId);
  if (!user) throw ApiError.badRequest('Assigned admin not found');

  const role = user.role as unknown as { slug?: string };
  const slug = typeof role === 'object' && role?.slug ? role.slug : '';
  if (slug !== ROLES.ADMIN) {
    throw ApiError.badRequest('Assigned user must be an Admin');
  }

  if (actor?.isSubAdmin) {
    const createdBy = resolveOwnerId(user.createdBy);
    if (createdBy !== actor.id) {
      throw ApiError.forbidden('You can only assign admins you created');
    }
  }
}

async function assertSubAdminScopeAccess(item: IReferenceOverlap, actor: Actor): Promise<void> {
  const createdById = resolveOwnerId(item.createdBy);
  if (createdById === actor.id) return;

  const assignedId = resolveUserId(item.assignedTo);
  const scopeIds = await getScopeUserIds(actor as ScopeActor);
  const childAdminIds = (scopeIds ?? []).filter((id) => id !== actor.id);
  if (assignedId && childAdminIds.includes(assignedId)) return;

  throw ApiError.forbidden('You do not have access to this record');
}

class ReferenceOverlapsService {
  private async scope(actor: Actor) {
    return buildAssignedToScope(actor as ScopeActor);
  }

  async list(query: ListQueryDto, actor: Actor): Promise<PaginatedResult<IReferenceOverlap>> {
    return referenceOverlapsRepository.paginate(query, await this.scope(actor));
  }

  async getById(id: string, actor: Actor): Promise<IReferenceOverlap> {
    const item = await referenceOverlapsRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Reference overlap not found');

    if (actor.isSuperAdmin) return item;

    if (actor.isSubAdmin) {
      await assertSubAdminScopeAccess(item, actor);
      return item;
    }

    assertAssignedAdmin(item, actor);
    return item;
  }

  async create(dto: CreateReferenceOverlapDto, actor: Actor): Promise<IReferenceOverlap> {
    assertPlatformWorkflow(actor, 'Only Super Admin or Sub Admin can create reference overlaps');
    await assertAdminUser(dto.assignedTo, actor);

    const created = await referenceOverlapsRepository.create({
      ...dto,
      status: REFERENCE_OVERLAP_STATUS.ACTIVE,
      ownership: '',
      createdBy: actor.id as never,
      updatedBy: actor.id as never,
      assignedTo: dto.assignedTo as never,
    });

    const populated = await referenceOverlapsRepository.findByIdPopulated(created._id.toString());
    const result = populated as IReferenceOverlap;

    await issuesNotificationsService.notifyReferenceOverlapAssigned(
      result as never,
      dto.assignedTo,
      actor,
    );

    return result;
  }

  async update(id: string, dto: UpdateReferenceOverlapDto, actor: Actor): Promise<IReferenceOverlap> {
    assertPlatformWorkflow(actor, 'Only Super Admin or Sub Admin can edit reference overlaps');

    const item = await referenceOverlapsRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Reference overlap not found');

    if (actor.isSubAdmin) {
      await assertSubAdminScopeAccess(item, actor);
    }

    if (dto.assignedTo) {
      await assertAdminUser(dto.assignedTo, actor);
    }

    await referenceOverlapsRepository.updateById(id, {
      ...dto,
      updatedBy: actor.id as never,
    });

    const populated = await referenceOverlapsRepository.findByIdPopulated(id);
    return populated as IReferenceOverlap;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: Actor): Promise<IReferenceOverlap> {
    assertPlatformWorkflow(actor, 'Only Super Admin or Sub Admin can change reference overlap status');

    const item = await referenceOverlapsRepository.findById(id);
    if (!item) throw ApiError.notFound('Reference overlap not found');

    if (actor.isSubAdmin) {
      await assertSubAdminScopeAccess(item, actor);
    }

    await referenceOverlapsRepository.updateById(id, {
      status: dto.status,
      updatedBy: actor.id as never,
    });

    const populated = await referenceOverlapsRepository.findByIdPopulated(id);
    return populated as IReferenceOverlap;
  }

  async updateOwnership(
    id: string,
    dto: UpdateOwnershipDto,
    actor: Actor,
  ): Promise<IReferenceOverlap> {
    if (canManagePlatformWorkflow(actor as ScopeActor)) {
      throw ApiError.forbidden('Only assigned Admin can update ownership');
    }

    const item = await referenceOverlapsRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Reference overlap not found');
    assertAssignedAdmin(item, actor);

    await referenceOverlapsRepository.updateById(id, {
      ownership: dto.ownership,
      updatedBy: actor.id as never,
    });

    const populated = await referenceOverlapsRepository.findByIdPopulated(id);
    const result = populated as IReferenceOverlap;

    await issuesNotificationsService.notifyReferenceOverlapOwnershipUpdated(
      result as never,
      dto.ownership,
      actor,
    );

    return result;
  }

  async remove(id: string, actor: Actor): Promise<void> {
    assertPlatformWorkflow(actor, 'Only Super Admin or Sub Admin can delete reference overlaps');

    const item = await referenceOverlapsRepository.findById(id);
    if (!item) throw ApiError.notFound('Reference overlap not found');

    if (actor.isSubAdmin) {
      await assertSubAdminScopeAccess(item, actor);
    }

    await referenceOverlapsRepository.deleteById(id);
  }

  async exportCsv(query: ExportQueryDto, actor: Actor): Promise<string> {
    const items = await referenceOverlapsRepository.findForExport(await this.scope(actor), {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const headers = [
      'Other Party',
      'Asset Name',
      'Asset Type',
      'ISRC',
      'Overlapping Asset Name',
      'Label',
      'Status',
      'Ownership',
      'Assigned Admin',
      'Assigned Email',
      'Created At',
      'Updated At',
    ];

    const rows = items.map((item) => {
      const assignee = item.assignedTo as unknown as IUser | undefined;
      return [
        escapeCsv(item.otherParty),
        escapeCsv(item.assetName),
        escapeCsv(item.assetType),
        escapeCsv(item.isrcCode),
        escapeCsv(item.overlappingAssetName),
        escapeCsv(item.labelName),
        escapeCsv(item.status),
        escapeCsv(formatOwnership(item.ownership)),
        escapeCsv(assignee?.name ?? ''),
        escapeCsv(assignee?.email ?? ''),
        escapeCsv(formatDateTime(item.createdAt)),
        escapeCsv(formatDateTime(item.updatedAt)),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}

export const referenceOverlapsService = new ReferenceOverlapsService();
