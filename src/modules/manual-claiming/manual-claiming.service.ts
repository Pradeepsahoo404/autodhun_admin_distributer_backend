import { manualClaimingRepository } from './manual-claiming.repository';
import { ApiError } from '@/utils/ApiError';
import { IManualClaiming, MANUAL_CLAIMING_STATUS } from './manual-claiming.model';
import { PaginatedResult } from '@/types';
import {
  CreateManualClaimingDto,
  ExportQueryDto,
  ListQueryDto,
  UpdateStatusDto,
  UpdateManualClaimingDto,
} from './manual-claiming.validator';
import { IUser } from '@/modules/user/user.model';
import { rightsManagerNotificationsService } from '@/modules/notification/rights-manager-notifications.service';
import { assertLabelsAccessible } from '@/utils/labelOwnership';

interface Actor {
  id: string;
  isSuperAdmin: boolean;
}

function assertOwnership(item: IManualClaiming, actor: Actor): void {
  if (actor.isSuperAdmin) return;
  const createdBy = item.createdBy as unknown;
  const ownerId =
    createdBy && typeof createdBy === 'object' && '_id' in (createdBy as object)
      ? String((createdBy as { _id: { toString(): string } })._id)
      : String(createdBy);
  if (ownerId !== actor.id) {
    throw ApiError.forbidden('You can only modify your own manual claiming entries');
  }
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

class ManualClaimingService {
  private scope(actor: Actor) {
    return actor.isSuperAdmin ? {} : { createdBy: actor.id };
  }

  async list(query: ListQueryDto, actor: Actor): Promise<PaginatedResult<IManualClaiming>> {
    return manualClaimingRepository.paginate(query, this.scope(actor));
  }

  async getById(id: string, actor: Actor): Promise<IManualClaiming> {
    const item = await manualClaimingRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Manual claiming entry not found');
    assertOwnership(item, actor);
    return item;
  }

  async create(dto: CreateManualClaimingDto, actor: Actor): Promise<IManualClaiming> {
    await assertLabelsAccessible(actor, dto.labelName);

    const created = await manualClaimingRepository.create({
      ...dto,
      status: MANUAL_CLAIMING_STATUS.IN_PROGRESS,
      createdBy: actor.id as never,
      updatedBy: actor.id as never,
    });
    const populated = await manualClaimingRepository.findByIdPopulated(created._id.toString());
    const result = populated as IManualClaiming;
    await rightsManagerNotificationsService.notifyEntryCreated('manual-claiming', result as never, actor);
    return result;
  }

  async update(
    id: string,
    dto: UpdateManualClaimingDto,
    actor: Actor,
  ): Promise<IManualClaiming> {
    const item = await manualClaimingRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Manual claiming entry not found');
    assertOwnership(item, actor);

    await assertLabelsAccessible(actor, dto.labelName);

    const updated = await manualClaimingRepository.updateById(id, {
      ...dto,
      updatedBy: actor.id as never,
    });
    const populated = await manualClaimingRepository.findByIdPopulated(updated!._id.toString());
    return populated as IManualClaiming;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: Actor): Promise<IManualClaiming> {
    if (!actor.isSuperAdmin) {
      throw ApiError.forbidden('Only Super Admin can change manual claiming status');
    }

    const item = await manualClaimingRepository.findById(id);
    if (!item) throw ApiError.notFound('Manual claiming entry not found');

    await manualClaimingRepository.updateById(id, {
      status: dto.status,
      updatedBy: actor.id as never,
    });

    const populated = await manualClaimingRepository.findByIdPopulated(id);
    const result = populated as IManualClaiming;
    await rightsManagerNotificationsService.notifyStatusUpdated(
      'manual-claiming',
      result as never,
      dto.status,
      actor,
    );
    return result;
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const item = await manualClaimingRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Manual claiming entry not found');
    assertOwnership(item, actor);
    await manualClaimingRepository.deleteById(id);
  }

  async exportCsv(query: ExportQueryDto, actor: Actor): Promise<string> {
    const items = await manualClaimingRepository.findForExport({
      ...this.scope(actor),
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const headers = [
      'Label Name',
      'Original Song Link',
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
        escapeCsv(item.originalSongLink),
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

export const manualClaimingService = new ManualClaimingService();
