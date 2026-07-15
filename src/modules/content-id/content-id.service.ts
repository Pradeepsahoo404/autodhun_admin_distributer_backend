import { contentIdRepository } from './content-id.repository';
import { ApiError } from '@/utils/ApiError';
import { CONTENT_ID_STATUS, IContentId } from './content-id.model';
import { PaginatedResult } from '@/types';
import {
  CreateContentIdDto,
  ExportQueryDto,
  ListQueryDto,
  UpdateStatusDto,
  UpdateContentIdDto,
} from './content-id.validator';
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

async function assertOwnership(item: IContentId, actor: Actor): Promise<void> {
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

class ContentIdService {
  private async scope(actor: Actor) {
    return buildCreatedByScope(actor as ScopeActor);
  }

  async list(query: ListQueryDto, actor: Actor): Promise<PaginatedResult<IContentId>> {
    return contentIdRepository.paginate(query, await this.scope(actor));
  }

  async getById(id: string, actor: Actor): Promise<IContentId> {
    const item = await contentIdRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Content ID entry not found');
    await assertOwnership(item, actor);
    return item;
  }

  async create(dto: CreateContentIdDto, actor: Actor): Promise<IContentId> {
    await assertLabelsAccessible(actor, dto.labelName);

    const created = await contentIdRepository.create({
      ...dto,
      status: CONTENT_ID_STATUS.IN_PROGRESS,
      createdBy: actor.id as never,
      updatedBy: actor.id as never,
    });
    const populated = await contentIdRepository.findByIdPopulated(created._id.toString());
    const result = populated as IContentId;
    await rightsManagerNotificationsService.notifyEntryCreated('content-id', result as never, actor);
    return result;
  }

  async update(id: string, dto: UpdateContentIdDto, actor: Actor): Promise<IContentId> {
    const item = await contentIdRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Content ID entry not found');
    await assertOwnership(item, actor);

    await assertLabelsAccessible(actor, dto.labelName);

    const updated = await contentIdRepository.updateById(id, {
      ...dto,
      updatedBy: actor.id as never,
    });
    const populated = await contentIdRepository.findByIdPopulated(updated!._id.toString());
    return populated as IContentId;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: Actor): Promise<IContentId> {
    if (!canManagePlatformWorkflow(actor as ScopeActor)) {
      throw ApiError.forbidden('Only Super Admin or Sub Admin can change content ID status');
    }

    const item = await contentIdRepository.findById(id);
    if (!item) throw ApiError.notFound('Content ID entry not found');

    await assertOwnership(item, actor);

    await contentIdRepository.updateById(id, {
      status: dto.status,
      updatedBy: actor.id as never,
    });

    const populated = await contentIdRepository.findByIdPopulated(id);
    const result = populated as IContentId;
    await rightsManagerNotificationsService.notifyStatusUpdated('content-id', result as never, dto.status, actor);
    return result;
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const item = await contentIdRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Content ID entry not found');
    await assertOwnership(item, actor);
    await contentIdRepository.deleteById(id);
  }

  async exportCsv(query: ExportQueryDto, actor: Actor): Promise<string> {
    const items = await contentIdRepository.findForExport({
      ...(await this.scope(actor)),
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const headers = [
      'Label Name',
      'ISRC',
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

export const contentIdService = new ContentIdService();
