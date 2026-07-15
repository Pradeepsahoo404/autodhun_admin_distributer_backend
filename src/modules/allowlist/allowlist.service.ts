import { allowlistRepository } from './allowlist.repository';
import { ApiError } from '@/utils/ApiError';
import { ALLOWLIST_STATUS, IAllowlist } from './allowlist.model';
import { PaginatedResult } from '@/types';
import {
  CreateAllowlistDto,
  ExportQueryDto,
  ListQueryDto,
  UpdateStatusDto,
  UpdateAllowlistDto,
} from './allowlist.validator';
import { IUser } from '@/modules/user/user.model';
import { rightsManagerNotificationsService } from '@/modules/notification/rights-manager-notifications.service';
import { assertLabelsAccessible } from '@/utils/labelOwnership';
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
}

async function assertOwnership(item: IAllowlist, actor: Actor): Promise<void> {
  await assertCreatedByAccess(actor as ScopeActor, item.createdBy);
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

class AllowlistService {
  private async scope(actor: Actor) {
    return buildCreatedByScope(actor as ScopeActor);
  }

  async list(query: ListQueryDto, actor: Actor): Promise<PaginatedResult<IAllowlist>> {
    return allowlistRepository.paginate(query, await this.scope(actor));
  }

  async getById(id: string, actor: Actor): Promise<IAllowlist> {
    const item = await allowlistRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Allowlist entry not found');
    await assertOwnership(item, actor);
    return item;
  }

  async create(dto: CreateAllowlistDto, actor: Actor): Promise<IAllowlist> {
    await assertLabelsAccessible(actor, dto.labelName);

    const created = await allowlistRepository.create({
      ...dto,
      status: ALLOWLIST_STATUS.IN_PROGRESS,
      createdBy: actor.id as never,
      updatedBy: actor.id as never,
    });
    const populated = await allowlistRepository.findByIdPopulated(created._id.toString());
    const result = populated as IAllowlist;
    await rightsManagerNotificationsService.notifyEntryCreated('allowlist', result as never, actor);
    return result;
  }

  async update(id: string, dto: UpdateAllowlistDto, actor: Actor): Promise<IAllowlist> {
    const item = await allowlistRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Allowlist entry not found');
    await assertOwnership(item, actor);

    await assertLabelsAccessible(actor, dto.labelName);

    const updated = await allowlistRepository.updateById(id, {
      ...dto,
      updatedBy: actor.id as never,
    });
    const populated = await allowlistRepository.findByIdPopulated(updated!._id.toString());
    return populated as IAllowlist;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: Actor): Promise<IAllowlist> {
    if (!canManagePlatformWorkflow(actor as ScopeActor)) {
      throw ApiError.forbidden('Only Super Admin or Sub Admin can change allowlist status');
    }

    const item = await allowlistRepository.findById(id);
    if (!item) throw ApiError.notFound('Allowlist entry not found');

    await assertOwnership(item, actor);

    await allowlistRepository.updateById(id, {
      status: dto.status,
      updatedBy: actor.id as never,
    });

    const populated = await allowlistRepository.findByIdPopulated(id);
    const result = populated as IAllowlist;
    await rightsManagerNotificationsService.notifyStatusUpdated('allowlist', result as never, dto.status, actor);
    return result;
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const item = await allowlistRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Allowlist entry not found');
    await assertOwnership(item, actor);
    await allowlistRepository.deleteById(id);
  }

  async exportCsv(query: ExportQueryDto, actor: Actor): Promise<string> {
    const items = await allowlistRepository.findForExport({
      ...(await this.scope(actor)),
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const headers = [
      'Label Name',
      'Channel Link',
      'Status',
      'Admin Name',
      'Admin Email',
      'Created At',
      'Updated At',
    ];

    const rows = items.map((item) => {
      const creator = item.createdBy as unknown as IUser | undefined;
      return [
        escapeCsv(item.labelName),
        escapeCsv(item.channelLink),
        escapeCsv(item.status),
        escapeCsv(creator?.name ?? ''),
        escapeCsv(creator?.email ?? ''),
        escapeCsv(formatDateTime(item.createdAt)),
        escapeCsv(formatDateTime(item.updatedAt)),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}

export const allowlistService = new AllowlistService();
