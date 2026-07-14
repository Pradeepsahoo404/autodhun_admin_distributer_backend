import { oacRepository } from './oac.repository';
import { ApiError } from '@/utils/ApiError';
import {
  assertFeatureAccess,
  createdByFeatureScope,
  requireWriteTenantId,
  type TenantActor,
} from '@/utils/tenantScope';
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

class OacService {
  private scope(actor: Actor) {
    return createdByFeatureScope(actor);
  }

  async list(query: ListQueryDto, actor: Actor): Promise<PaginatedResult<IOac>> {
    return oacRepository.paginate(query, this.scope(actor));
  }

  async getById(id: string, actor: Actor): Promise<IOac> {
    const item = await oacRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('OAC entry not found');
    assertFeatureAccess(actor, item, 'createdBy');
    return item;
  }

  async create(dto: CreateOacDto, actor: Actor): Promise<IOac> {
    const created = await oacRepository.create({
      tenantId: requireWriteTenantId(actor) as never,
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
    assertFeatureAccess(actor, item, 'createdBy');

    const updated = await oacRepository.updateById(id, {
      ...dto,
      updatedBy: actor.id as never,
    });
    const populated = await oacRepository.findByIdPopulated(updated!._id.toString());
    return populated as IOac;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: Actor): Promise<IOac> {
    if (!actor.isSuperAdmin) {
      throw ApiError.forbidden('Only Super Admin can change OAC status');
    }

    const item = await oacRepository.findById(id);
    if (!item) throw ApiError.notFound('OAC entry not found');
    assertFeatureAccess(actor, item, 'createdBy');

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
    assertFeatureAccess(actor, item, 'createdBy');
    await oacRepository.deleteById(id);
  }

  async exportCsv(query: ExportQueryDto, actor: Actor): Promise<string> {
    const items = await oacRepository.findForExport({
      ...this.scope(actor),
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
