import {
  buildIssuesEntrySummary,
  ISSUES_MODULES,
  IssuesModuleSlug,
} from '@/constants/issuesModules';
import { NOTIFICATION_TYPE } from './notification.model';
import { notificationRepository } from './notification.repository';
import { logger } from '@/config/logger';
import { resolveUserId } from './issues-notifications.resolve';
import { findOversightRecipientIds } from './notification-recipients';

interface Actor {
  id: string;
  isSuperAdmin: boolean;
  name?: string;
}

function formatOwnershipLabel(ownership: string): string {
  if (ownership === 'yes') return 'Yes';
  if (ownership === 'no') return 'No';
  return 'Pending';
}

class IssuesNotificationsService {
  private buildRoute(moduleSlug: IssuesModuleSlug, entryId: string): string {
    return `${ISSUES_MODULES[moduleSlug].route}?entry=${entryId}`;
  }

  async notifyEntryAssigned(
    moduleSlug: IssuesModuleSlug,
    entry: Record<string, unknown> & { _id: { toString(): string } },
    assignedToId: string,
    actor: Actor,
  ): Promise<void> {
    try {
      const config = ISSUES_MODULES[moduleSlug];
      const entryId = entry._id.toString();
      const summary = buildIssuesEntrySummary(moduleSlug, entry);

      await notificationRepository.create({
        recipient: assignedToId as never,
        type: NOTIFICATION_TYPE.ISSUES_ENTRY_ASSIGNED,
        moduleSlug: config.slug,
        moduleName: config.name,
        entryId,
        route: this.buildRoute(moduleSlug, entryId),
        title: `New ${config.name} assigned`,
        message: `A new ${config.name} entry was assigned to you.`,
        entrySummary: summary,
        actor: actor.id as never,
      });
    } catch (error) {
      logger.error('Failed to notify admin of assigned issues entry', { moduleSlug, error });
    }
  }

  async notifyOwnershipUpdated(
    moduleSlug: IssuesModuleSlug,
    entry: Record<string, unknown> & { _id: { toString(): string } },
    ownership: string,
    actor: Actor,
  ): Promise<void> {
    if (actor.isSuperAdmin) return;

    try {
      const config = ISSUES_MODULES[moduleSlug];
      const entryId = entry._id.toString();
      const summary = buildIssuesEntrySummary(moduleSlug, { ...entry, ownership });
      const ownershipLabel = formatOwnershipLabel(ownership);

      const oversightRecipientIds = await findOversightRecipientIds(actor.id, config.slug);
      const creatorId = resolveUserId(entry.createdBy);
      const recipientIds = [
        ...new Set([
          ...oversightRecipientIds,
          ...(creatorId && creatorId !== actor.id ? [creatorId] : []),
        ]),
      ];
      if (recipientIds.length === 0) return;

      const payloads = recipientIds.map((recipientId) => ({
        recipient: recipientId as never,
        type: NOTIFICATION_TYPE.ISSUES_OWNERSHIP_UPDATED,
        moduleSlug: config.slug,
        moduleName: config.name,
        entryId,
        route: this.buildRoute(moduleSlug, entryId),
        title: `${config.name} ownership updated`,
        message: `Ownership was updated to ${ownershipLabel}.`,
        entrySummary: summary,
        actor: actor.id as never,
      }));

      await notificationRepository.createMany(payloads);
    } catch (error) {
      logger.error('Failed to notify super admins of issues ownership update', { moduleSlug, error });
    }
  }

  /** @deprecated use notifyEntryAssigned */
  async notifyReferenceOverlapAssigned(
    entry: Record<string, unknown> & { _id: { toString(): string } },
    assignedToId: string,
    actor: Actor,
  ): Promise<void> {
    return this.notifyEntryAssigned('reference-overlaps', entry, assignedToId, actor);
  }

  /** @deprecated use notifyOwnershipUpdated */
  async notifyReferenceOverlapOwnershipUpdated(
    entry: Record<string, unknown> & { _id: { toString(): string } },
    ownership: string,
    actor: Actor,
  ): Promise<void> {
    return this.notifyOwnershipUpdated('reference-overlaps', entry, ownership, actor);
  }
}

export const issuesNotificationsService = new IssuesNotificationsService();

export { resolveUserId } from './issues-notifications.resolve';
