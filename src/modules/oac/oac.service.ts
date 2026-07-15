import { oacRepository } from './oac.repository';
import { ApiError } from '@/utils/ApiError';
import { IOac, OAC_STATUS } from './oac.model';
import { PaginatedResult } from '@/types';
import {
  CreateOacDto,
  ExportQueryDto,
  ListQueryDto,
  UpdateStatusDto,
  UpdateOacDto,
} from './oac.validator';
import { IUser } from '@/modules/user/user.model';
import { rightsManagerNotificationsService } from '@/modules/notification/rights-manager-notifications.service';
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

async function assertOwnership(item: IOac, actor: Actor): Promise<void> {
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

class OacService {
  private async scope(actor: Actor) {
    return buildCreatedByScope(actor as ScopeActor);
  }

  async list(query: ListQueryDto, actor: Actor): Promise<PaginatedResult<IOac>> {
    return oacRepository.paginate(query, await this.scope(actor));
  }

  async getById(id: string, actor: Actor): Promise<IOac> {
    const item = await oacRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('OAC entry not found');
    await assertOwnership(item, actor);
    return item;
  }

  async create(dto: CreateOacDto, actor: Actor): Promise<IOac> {
    const created = await oacRepository.create({
      ...dto,
      status: OAC_STATUS.IN_PROGRESS,
      createdBy: actor.id as never,
      updatedBy: actor.id as never,
    });
    const populated = await oacRepository.findByIdPopulated(created._id.toString());
    const result = populated as IOac;
    await rightsManagerNotificationsService.notifyEntryCreated('oac', result as never, actor);
    return result;
  }

  async update(id: string, dto: UpdateOacDto, actor: Actor): Promise<IOac> {
    const item = await oacRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('OAC entry not found');
    await assertOwnership(item, actor);

    const updated = await oacRepository.updateById(id, {
      ...dto,
      updatedBy: actor.id as never,
    });
    const populated = await oacRepository.findByIdPopulated(updated!._id.toString());
    return populated as IOac;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: Actor): Promise<IOac> {
    if (!canManagePlatformWorkflow(actor as ScopeActor)) {
      throw ApiError.forbidden('Only Super Admin or Sub Admin can change OAC status');
    }

    const item = await oacRepository.findById(id);
    if (!item) throw ApiError.notFound('OAC entry not found');

    await assertOwnership(item, actor);

    await oacRepository.updateById(id, {
      status: dto.status,
      updatedBy: actor.id as never,
    });

    const populated = await oacRepository.findByIdPopulated(id);
    const result = populated as IOac;
    await rightsManagerNotificationsService.notifyStatusUpdated('oac', result as never, dto.status, actor);
    return result;
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const item = await oacRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('OAC entry not found');
    await assertOwnership(item, actor);
    await oacRepository.deleteById(id);
  }

  async exportCsv(query: ExportQueryDto, actor: Actor): Promise<string> {
    const items = await oacRepository.findForExport({
      ...(await this.scope(actor)),
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const headers = [
      'Artist Channel Name',
      'Artist Channel Link',
      'Artist Channel Topic Link',
      'ISRC Code',
      'Status',
      'Admin Name',
      'Admin Email',
      'Created At',
      'Updated At',
    ];

    const rows = items.map((item) => {
      const creator = item.createdBy as unknown as IUser | undefined;
      return [
        escapeCsv(item.artistChannelName),
        escapeCsv(item.artistChannelLink),
        escapeCsv(item.artistChannelTopicLink),
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

export const oacService = new OacService();
