import { findElevatedRecipientIds } from '@/utils/elevatedRecipients';
import type { IUser } from '@/modules/user/user.model';
import { NOTIFICATION_TYPE } from './notification.model';
import { notificationRepository } from './notification.repository';
import { logger } from '@/config/logger';

interface Actor {
  id: string;
  isSuperAdmin: boolean;
  name?: string;
  tenantId?: string | null;
}

interface ChannelModuleConfig {
  slug: string;
  name: string;
  route: string;
}

function resolveOwnerId(createdBy: unknown): string | null {
  if (!createdBy) return null;
  if (typeof createdBy === 'object' && createdBy !== null && '_id' in createdBy) {
    return String((createdBy as { _id: { toString(): string } })._id);
  }
  return String(createdBy);
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

class ChannelNotificationsService {
  private findSuperAdminIds(tenantId?: string | null): Promise<string[]> {
    return findElevatedRecipientIds(tenantId);
  }

  private buildRoute(config: ChannelModuleConfig, entryId: string): string {
    return `${config.route}?entry=${entryId}`;
  }

  /** Notify all super admins when an admin creates a channel/linking entry. */
  async notifyEntryCreated(
    config: ChannelModuleConfig,
    entry: Record<string, unknown> & { _id: { toString(): string } },
    actor: Actor,
    summary: Record<string, string> = {},
  ): Promise<void> {
    if (actor.isSuperAdmin) return;

    try {
      const entryId = entry._id.toString();
      const creator = entry.createdBy as IUser | undefined;
      const creatorName =
        creator && typeof creator === 'object' && 'name' in creator
          ? creator.name
          : actor.name ?? 'Admin';

      const superAdminIds = await this.findSuperAdminIds(actor.tenantId);
      if (superAdminIds.length === 0) return;

      const payloads = superAdminIds.map((recipientId) => ({
        recipient: recipientId as never,
        type: NOTIFICATION_TYPE.CHANNEL_ENTRY_CREATED,
        moduleSlug: config.slug,
        moduleName: config.name,
        entryId,
        route: this.buildRoute(config, entryId),
        title: `New ${config.name} entry`,
        message: `${creatorName} submitted a new ${config.name} entry for review.`,
        entrySummary: summary,
        actor: actor.id as never,
      }));

      await notificationRepository.createMany(payloads);
    } catch (error) {
      logger.error('Failed to notify super admins of channel entry', { slug: config.slug, error });
    }
  }

  /** Notify the entry creator when a super admin changes its status. */
  async notifyStatusUpdated(
    config: ChannelModuleConfig,
    entry: Record<string, unknown> & { _id: { toString(): string } },
    newStatus: string,
    actor: Actor,
    summary: Record<string, string> = {},
  ): Promise<void> {
    if (!actor.isSuperAdmin) return;

    try {
      const ownerId = resolveOwnerId(entry.createdBy);
      if (!ownerId || ownerId === actor.id) return;

      const entryId = entry._id.toString();
      const statusLabel = formatStatusLabel(newStatus);

      await notificationRepository.create({
        recipient: ownerId as never,
        type: NOTIFICATION_TYPE.CHANNEL_STATUS_UPDATED,
        moduleSlug: config.slug,
        moduleName: config.name,
        entryId,
        route: this.buildRoute(config, entryId),
        title: `${config.name} status updated`,
        message: `Your ${config.name} entry status was updated to ${statusLabel}.`,
        entrySummary: { ...summary, status: newStatus },
        actor: actor.id as never,
      });
    } catch (error) {
      logger.error('Failed to notify admin of channel status update', { slug: config.slug, error });
    }
  }
}

export const CHANNEL_NOTIFICATION_CONFIG = {
  createChannel: {
    slug: 'create-channel',
    name: 'Create Channel',
    route: '/dashboard/channels/create',
  },
  channelLinking: {
    slug: 'channel-linking',
    name: 'Linking',
    route: '/dashboard/channels/linking',
  },
} as const;

export const channelNotificationsService = new ChannelNotificationsService();
