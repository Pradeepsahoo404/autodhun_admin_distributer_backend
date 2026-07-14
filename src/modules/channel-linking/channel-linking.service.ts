import { channelLinkingRepository } from './channel-linking.repository';
import { ApiError } from '@/utils/ApiError';
import {
  CHANNEL_LINKING_AUTO_REJECT_MINUTES,
  CHANNEL_LINKING_MIN_REVENUE_USD,
  CHANNEL_LINKING_STATUS,
  ChannelLinkingModel,
  IChannelLinking,
} from './channel-linking.model';
import { PaginatedResult } from '@/types';
import {
  CreateChannelLinkingDto,
  ExportQueryDto,
  ListQueryDto,
  UpdateChannelLinkingDto,
  UpdateStatusDto,
} from './channel-linking.validator';
import { IUser } from '@/modules/user/user.model';
import {
  CHANNEL_NOTIFICATION_CONFIG,
  channelNotificationsService,
} from '@/modules/notification/channel-notifications.service';

interface Actor {
  id: string;
  isSuperAdmin: boolean;
  name?: string;
}

function assertOwnership(item: IChannelLinking, actor: Actor): void {
  if (actor.isSuperAdmin) return;
  const createdBy = item.createdBy as unknown;
  const ownerId =
    createdBy && typeof createdBy === 'object' && '_id' in (createdBy as object)
      ? String((createdBy as { _id: { toString(): string } })._id)
      : String(createdBy);
  if (ownerId !== actor.id) {
    throw ApiError.forbidden('You can only modify your own channel linking entries');
  }
}

function buildLinkingSummary(item: IChannelLinking): Record<string, string> {
  return {
    channelName: item.channelName,
    channelLink: item.channelLink,
    totalRevenue90Days: String(item.totalRevenue90Days),
    totalViews90Days: String(item.totalViews90Days),
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

function resolveAutoRejectAt(revenue: number): Date | null {
  if (revenue >= CHANNEL_LINKING_MIN_REVENUE_USD) return null;
  const at = new Date();
  at.setMinutes(at.getMinutes() + CHANNEL_LINKING_AUTO_REJECT_MINUTES);
  return at;
}

class ChannelLinkingService {
  private scope(actor: Actor) {
    return actor.isSuperAdmin ? {} : { createdBy: actor.id };
  }

  async list(query: ListQueryDto, actor: Actor): Promise<PaginatedResult<IChannelLinking>> {
    return channelLinkingRepository.paginate(query, this.scope(actor));
  }

  async getById(id: string, actor: Actor): Promise<IChannelLinking> {
    const item = await channelLinkingRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Channel linking entry not found');
    assertOwnership(item, actor);
    return item;
  }

  async create(dto: CreateChannelLinkingDto, actor: Actor): Promise<IChannelLinking> {
    const autoRejectAt = resolveAutoRejectAt(dto.totalRevenue90Days);

    const created = await channelLinkingRepository.create({
      ...dto,
      status: CHANNEL_LINKING_STATUS.IN_PROCESS,
      autoRejectAt,
      createdBy: actor.id as never,
      updatedBy: actor.id as never,
    });

    const populated = await channelLinkingRepository.findByIdPopulated(created._id.toString());
    const result = populated as IChannelLinking;
    await channelNotificationsService.notifyEntryCreated(
      CHANNEL_NOTIFICATION_CONFIG.channelLinking,
      result as never,
      actor,
      buildLinkingSummary(result),
    );
    return result;
  }

  async update(
    id: string,
    dto: UpdateChannelLinkingDto,
    actor: Actor,
  ): Promise<IChannelLinking> {
    const item = await channelLinkingRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Channel linking entry not found');

    if (actor.isSuperAdmin) {
      const revenue = dto.totalRevenue90Days ?? item.totalRevenue90Days;
      const autoRejectAt =
        dto.totalRevenue90Days !== undefined ? resolveAutoRejectAt(revenue) : item.autoRejectAt;

      await channelLinkingRepository.updateById(id, {
        ...dto,
        autoRejectAt,
        updatedBy: actor.id as never,
      });
    } else {
      assertOwnership(item, actor);

      // Any admin edit sends the entry back for review, even if it was
      // previously approved or rejected. Revenue re-evaluates auto-reject.
      const revenue = dto.totalRevenue90Days ?? item.totalRevenue90Days;

      await channelLinkingRepository.updateById(id, {
        ...dto,
        status: CHANNEL_LINKING_STATUS.IN_PROCESS,
        autoRejectAt: resolveAutoRejectAt(revenue),
        updatedBy: actor.id as never,
      });
    }

    const populated = await channelLinkingRepository.findByIdPopulated(id);
    return populated as IChannelLinking;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: Actor): Promise<IChannelLinking> {
    if (!actor.isSuperAdmin) {
      throw ApiError.forbidden('Only Super Admin can change channel linking status');
    }

    const item = await channelLinkingRepository.findById(id);
    if (!item) throw ApiError.notFound('Channel linking entry not found');

    await channelLinkingRepository.updateById(id, {
      status: dto.status,
      autoRejectAt: dto.status === CHANNEL_LINKING_STATUS.IN_PROCESS ? item.autoRejectAt : null,
      updatedBy: actor.id as never,
    });

    const populated = await channelLinkingRepository.findByIdPopulated(id);
    const result = populated as IChannelLinking;
    await channelNotificationsService.notifyStatusUpdated(
      CHANNEL_NOTIFICATION_CONFIG.channelLinking,
      result as never,
      dto.status,
      actor,
      buildLinkingSummary(result),
    );
    return result;
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const item = await channelLinkingRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Channel linking entry not found');

    // Admins may delete their own entries at any point (including approved).
    assertOwnership(item, actor);

    await channelLinkingRepository.deleteById(id);
  }

  async exportCsv(query: ExportQueryDto, actor: Actor): Promise<string> {
    const items = await channelLinkingRepository.findForExport({
      ...this.scope(actor),
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const headers = [
      'Channel Link',
      'Channel Name',
      'Total Revenue (90 days)',
      'Total Views (90 days)',
      'Status',
      'Admin Name',
      'Admin Email',
      'Created At',
      'Updated At',
    ];

    const rows = items.map((item) => {
      const creator = item.createdBy as unknown as IUser | undefined;
      return [
        escapeCsv(item.channelLink),
        escapeCsv(item.channelName),
        escapeCsv(String(item.totalRevenue90Days)),
        escapeCsv(String(item.totalViews90Days)),
        escapeCsv(item.status),
        escapeCsv(creator?.name ?? ''),
        escapeCsv(creator?.email ?? ''),
        escapeCsv(formatDateTime(item.createdAt)),
        escapeCsv(formatDateTime(item.updatedAt)),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  async processAutoRejections(): Promise<number> {
    const now = new Date();
    const result = await ChannelLinkingModel.updateMany(
      {
        status: CHANNEL_LINKING_STATUS.IN_PROCESS,
        autoRejectAt: { $ne: null, $lte: now },
      },
      {
        $set: {
          status: CHANNEL_LINKING_STATUS.REJECTED,
          autoRejectAt: null,
        },
      },
    );

    return result.modifiedCount ?? 0;
  }
}

export const channelLinkingService = new ChannelLinkingService();
