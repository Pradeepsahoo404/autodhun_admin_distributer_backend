import { IssuesModuleSlug } from '@/constants/issuesModules';
import { ApiError } from '@/utils/ApiError';
import { PaginatedResult } from '@/types';
import { IUser } from '@/modules/user/user.model';
import { userRepository } from '@/modules/user/user.repository';
import { ROLES } from '@/constants';
import { issuesNotificationsService } from '@/modules/notification/issues-notifications.service';
import {
  assertFeatureAccess,
  assignedToFeatureScope,
  isPlatformMaster,
  requireWriteTenantId,
  type TenantActor,
} from '@/utils/tenantScope';
import { ISSUES_ENTRY_STATUS } from './issues-entry.constants';
import { IIssuesEntry } from './issues-entry.model';
import { IssuesEntryRepository } from './issues-entry.repository';
import {
  CreateIssuesEntryDto,
  IssuesEntryExportQueryDto,
  IssuesEntryListQueryDto,
  UpdateIssuesEntryDto,
  UpdateIssuesEntryOwnershipDto,
  UpdateIssuesEntryStatusDto,
} from './issues-entry.validator';

type Actor = TenantActor;

export interface IssuesEntryModuleMeta {
  moduleSlug: IssuesModuleSlug;
  singularLabel: string;
  pluralLabel: string;
  exportFilePrefix: string;
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

function assertSuperAdmin(actor: Actor, message: string): void {
  if (!actor.isSuperAdmin) {
    throw ApiError.forbidden(message);
  }
}

async function assertAdminUser(userId: string, actor: Actor): Promise<void> {
  const user = await userRepository.findByIdWithRole(userId);
  if (!user) throw ApiError.badRequest('Assigned admin not found');

  const role = user.role as unknown as { slug?: string };
  const slug = typeof role === 'object' && role?.slug ? role.slug : '';
  if (slug !== ROLES.ADMIN) {
    throw ApiError.badRequest('Assigned user must be an Admin');
  }

  if (!isPlatformMaster(actor)) {
    const assigneeTenantId = user.tenantId ? String(user.tenantId) : null;
    if (!actor.tenantId || !assigneeTenantId || actor.tenantId !== assigneeTenantId) {
      throw ApiError.badRequest('Assigned admin must belong to your tenant');
    }
  }
}

export class IssuesEntryService {
  constructor(
    private readonly repository: IssuesEntryRepository,
    private readonly meta: IssuesEntryModuleMeta,
  ) {}

  private scope(actor: Actor) {
    return assignedToFeatureScope(actor);
  }

  private notFoundMessage(): string {
    return `${this.meta.singularLabel} not found`;
  }

  async list(query: IssuesEntryListQueryDto, actor: Actor): Promise<PaginatedResult<IIssuesEntry>> {
    return this.repository.paginate(query, this.scope(actor));
  }

  async getById(id: string, actor: Actor): Promise<IIssuesEntry> {
    const item = await this.repository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound(this.notFoundMessage());
    assertFeatureAccess(actor, item, 'assignedTo');
    return item;
  }

  async create(dto: CreateIssuesEntryDto, actor: Actor): Promise<IIssuesEntry> {
    assertSuperAdmin(actor, `Only Super Admin can create ${this.meta.pluralLabel.toLowerCase()}`);
    await assertAdminUser(dto.assignedTo, actor);

    const created = await this.repository.create({
      ...dto,
      tenantId: requireWriteTenantId(actor) as never,
      status: ISSUES_ENTRY_STATUS.ACTIVE,
      ownership: '',
      createdBy: actor.id as never,
      updatedBy: actor.id as never,
      assignedTo: dto.assignedTo as never,
    });

    const populated = await this.repository.findByIdPopulated(created._id.toString());
    const result = populated as IIssuesEntry;

    await issuesNotificationsService.notifyEntryAssigned(
      this.meta.moduleSlug,
      result as never,
      dto.assignedTo,
      actor,
    );

    return result;
  }

  async update(id: string, dto: UpdateIssuesEntryDto, actor: Actor): Promise<IIssuesEntry> {
    assertSuperAdmin(actor, `Only Super Admin can edit ${this.meta.pluralLabel.toLowerCase()}`);

    const item = await this.repository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound(this.notFoundMessage());
    assertFeatureAccess(actor, item, 'assignedTo');

    if (dto.assignedTo) {
      await assertAdminUser(dto.assignedTo, actor);
    }

    await this.repository.updateById(id, {
      ...dto,
      updatedBy: actor.id as never,
    });

    const populated = await this.repository.findByIdPopulated(id);
    return populated as IIssuesEntry;
  }

  async updateStatus(id: string, dto: UpdateIssuesEntryStatusDto, actor: Actor): Promise<IIssuesEntry> {
    assertSuperAdmin(actor, `Only Super Admin can change ${this.meta.singularLabel.toLowerCase()} status`);

    const item = await this.repository.findById(id);
    if (!item) throw ApiError.notFound(this.notFoundMessage());
    assertFeatureAccess(actor, item, 'assignedTo');

    await this.repository.updateById(id, {
      status: dto.status,
      updatedBy: actor.id as never,
    });

    const populated = await this.repository.findByIdPopulated(id);
    return populated as IIssuesEntry;
  }

  async updateOwnership(
    id: string,
    dto: UpdateIssuesEntryOwnershipDto,
    actor: Actor,
  ): Promise<IIssuesEntry> {
    if (actor.isSuperAdmin) {
      throw ApiError.forbidden('Only assigned Admin can update ownership');
    }

    const item = await this.repository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound(this.notFoundMessage());
    assertFeatureAccess(actor, item, 'assignedTo');

    await this.repository.updateById(id, {
      ownership: dto.ownership,
      updatedBy: actor.id as never,
    });

    const populated = await this.repository.findByIdPopulated(id);
    const result = populated as IIssuesEntry;

    await issuesNotificationsService.notifyOwnershipUpdated(
      this.meta.moduleSlug,
      result as never,
      dto.ownership,
      actor,
    );

    return result;
  }

  async remove(id: string, actor: Actor): Promise<void> {
    assertSuperAdmin(actor, `Only Super Admin can delete ${this.meta.pluralLabel.toLowerCase()}`);

    const item = await this.repository.findById(id);
    if (!item) throw ApiError.notFound(this.notFoundMessage());
    assertFeatureAccess(actor, item, 'assignedTo');
    await this.repository.deleteById(id);
  }

  async exportCsv(query: IssuesEntryExportQueryDto, actor: Actor): Promise<string> {
    const items = await this.repository.findForExport({
      ...this.scope(actor),
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
