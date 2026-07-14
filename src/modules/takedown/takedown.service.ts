import { takedownRepository } from './takedown.repository';
import { ApiError } from '@/utils/ApiError';
import {
  assertFeatureAccess,
  createdByFeatureScope,
  requireWriteTenantId,
  type TenantActor,
} from '@/utils/tenantScope';
import { ITakedown, TAKEDOWN_STATUS } from './takedown.model';
import { PaginatedResult } from '@/types';
import {
  CreateTakedownDto,
  ExportQueryDto,
  ListQueryDto,
  UpdateStatusDto,
  UpdateTakedownDto,
} from './takedown.validator';
import { IUser } from '@/modules/user/user.model';
import { rightsManagerNotificationsService } from '@/modules/notification/rights-manager-notifications.service';
import { assertLabelsAccessible } from '@/utils/labelOwnership';

type Actor = TenantActor;

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

class TakedownService {
  private scope(actor: Actor) {
    return createdByFeatureScope(actor);
  }

  async list(query: ListQueryDto, actor: Actor): Promise<PaginatedResult<ITakedown>> {
    return takedownRepository.paginate(query, this.scope(actor));
  }

  async getById(id: string, actor: Actor): Promise<ITakedown> {
    const item = await takedownRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Takedown entry not found');
    assertFeatureAccess(actor, item, 'createdBy');
    return item;
  }

  async create(dto: CreateTakedownDto, actor: Actor): Promise<ITakedown> {
    await assertLabelsAccessible(actor, dto.labelName);

    const created = await takedownRepository.create({
      tenantId: requireWriteTenantId(actor) as never,
      ...dto,
      status: TAKEDOWN_STATUS.IN_PROGRESS,
      createdBy: actor.id as never,
      updatedBy: actor.id as never,
    });
    const populated = await takedownRepository.findByIdPopulated(created._id.toString());
    const result = populated as ITakedown;
    await rightsManagerNotificationsService.notifyEntryCreated('takedown', result as never, actor);
    return result;
  }

  async update(id: string, dto: UpdateTakedownDto, actor: Actor): Promise<ITakedown> {
    const item = await takedownRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Takedown entry not found');
    assertFeatureAccess(actor, item, 'createdBy');

    await assertLabelsAccessible(actor, dto.labelName);

    const updated = await takedownRepository.updateById(id, {
      ...dto,
      updatedBy: actor.id as never,
    });
    const populated = await takedownRepository.findByIdPopulated(updated!._id.toString());
    return populated as ITakedown;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: Actor): Promise<ITakedown> {
    if (!actor.isSuperAdmin) {
      throw ApiError.forbidden('Only Super Admin can change takedown status');
    }

    const item = await takedownRepository.findById(id);
    if (!item) throw ApiError.notFound('Takedown entry not found');

    await takedownRepository.updateById(id, {
      status: dto.status,
      updatedBy: actor.id as never,
    });

    const populated = await takedownRepository.findByIdPopulated(id);
    const result = populated as ITakedown;
    await rightsManagerNotificationsService.notifyStatusUpdated('takedown', result as never, dto.status, actor);
    return result;
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const item = await takedownRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Takedown entry not found');
    assertFeatureAccess(actor, item, 'createdBy');
    await takedownRepository.deleteById(id);
  }

  async exportCsv(query: ExportQueryDto, actor: Actor): Promise<string> {
    const items = await takedownRepository.findForExport({
      ...this.scope(actor),
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const headers = [
      'Label Name',
      'ISRC Code',
      'Song Link',
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
        escapeCsv(item.isrcCode),
        escapeCsv(item.songLink),
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

export const takedownService = new TakedownService();
