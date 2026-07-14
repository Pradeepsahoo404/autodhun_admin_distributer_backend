import { channelRepository } from './channel.repository';
import { ApiError } from '@/utils/ApiError';
import {
  assertFeatureAccess,
  createdByFeatureScope,
  requireWriteTenantId,
  type TenantActor,
} from '@/utils/tenantScope';
import { CHANNEL_STATUS, IChannel } from './channel.model';
import { PaginatedResult } from '@/types';
import {
  CreateChannelDto,
  ExportQueryDto,
  ListQueryDto,
  UpdateChannelDto,
  UpdateStatusDto,
} from './channel.validator';
import { IUser } from '@/modules/user/user.model';
import {
  CHANNEL_NOTIFICATION_CONFIG,
  channelNotificationsService,
} from '@/modules/notification/channel-notifications.service';

type Actor = TenantActor;

function buildChannelSummary(item: IChannel): Record<string, string> {
  return {
    channelName: item.channelName,
    channelLink: item.channelLink,
    status: item.status,
  };
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

class ChannelService {
  private scope(actor: Actor) {
    return createdByFeatureScope(actor);
  }

  async list(query: ListQueryDto, actor: Actor): Promise<PaginatedResult<IChannel>> {
    return channelRepository.paginate(query, this.scope(actor));
  }

  async getById(id: string, actor: Actor): Promise<IChannel> {
    const item = await channelRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Channel not found');
    assertFeatureAccess(actor, item, 'createdBy');
    return item;
  }

  async create(dto: CreateChannelDto, actor: Actor): Promise<IChannel> {
    const created = await channelRepository.create({
      tenantId: requireWriteTenantId(actor) as never,
      ...dto,
      status: CHANNEL_STATUS.ACTIVE,
      createdBy: actor.id as never,
      updatedBy: actor.id as never,
    });
    const populated = await channelRepository.findByIdPopulated(created._id.toString());
    const result = populated as IChannel;
    await channelNotificationsService.notifyEntryCreated(
      CHANNEL_NOTIFICATION_CONFIG.createChannel,
      result as never,
      actor,
      buildChannelSummary(result),
    );
    return result;
  }

  async update(id: string, dto: UpdateChannelDto, actor: Actor): Promise<IChannel> {
    const item = await channelRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Channel not found');
    assertFeatureAccess(actor, item, 'createdBy');

    const updated = await channelRepository.updateById(id, {
      ...dto,
      updatedBy: actor.id as never,
    });
    const populated = await channelRepository.findByIdPopulated(updated!._id.toString());
    return populated as IChannel;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: Actor): Promise<IChannel> {
    if (!actor.isSuperAdmin) {
      throw ApiError.forbidden('Only Super Admin can change channel status');
    }

    const item = await channelRepository.findById(id);
    if (!item) throw ApiError.notFound('Channel not found');
    assertFeatureAccess(actor, item, 'createdBy');

    await channelRepository.updateById(id, {
      status: dto.status,
      updatedBy: actor.id as never,
    });

    const populated = await channelRepository.findByIdPopulated(id);
    const result = populated as IChannel;
    await channelNotificationsService.notifyStatusUpdated(
      CHANNEL_NOTIFICATION_CONFIG.createChannel,
      result as never,
      dto.status,
      actor,
      buildChannelSummary(result),
    );
    return result;
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const item = await channelRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Channel not found');
    assertFeatureAccess(actor, item, 'createdBy');
    await channelRepository.deleteById(id);
  }

  async exportCsv(query: ExportQueryDto, actor: Actor): Promise<string> {
    const items = await channelRepository.findForExport({
      ...this.scope(actor),
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const headers = [
      'Channel Name',
      'Existing Channel Link',
      'Status',
      'Admin Name',
      'Admin Email',
      'Created At',
      'Updated At',
    ];

    const rows = items.map((item) => {
      const creator = item.createdBy as unknown as IUser | undefined;
      return [
        escapeCsv(item.channelName),
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

export const channelService = new ChannelService();
