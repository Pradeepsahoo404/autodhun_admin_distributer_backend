import { ROLES, USER_STATUS } from '@/constants';
import { roleRepository } from '@/modules/role/role.repository';
import { UserModel } from '@/modules/user/user.model';
import { IMusicRelease } from '@/modules/music-release/music-release.model';
import {
  MUSIC_RELEASE_STATUS,
  type MusicReleaseStatus,
} from '@/modules/music-release/music-release.constants';
import { NOTIFICATION_TYPE } from './notification.model';
import { notificationRepository } from './notification.repository';
import { logger } from '@/config/logger';

interface Actor {
  id: string;
  isSuperAdmin: boolean;
  name?: string;
}

const CONTENT_DELIVERY_MODULE = {
  slug: 'content-delivery',
  name: 'Content Delivery',
  route: '/dashboard/content-delivery',
} as const;

const ADMIN_STATUS_MODULES: Record<
  MusicReleaseStatus,
  { slug: string; name: string; route: string } | null
> = {
  [MUSIC_RELEASE_STATUS.IN_REVIEW]: null,
  [MUSIC_RELEASE_STATUS.CORRECTION]: {
    slug: 'release-correction',
    name: 'Correction',
    route: '/dashboard/release/correction',
  },
  [MUSIC_RELEASE_STATUS.QC_APPROVAL]: {
    slug: 'assets',
    name: 'Assets',
    route: '/dashboard/assets',
  },
  [MUSIC_RELEASE_STATUS.LIVE]: {
    slug: 'assets',
    name: 'Assets',
    route: '/dashboard/assets',
  },
};

function resolveOwnerId(createdBy: unknown): string | null {
  if (!createdBy) return null;
  if (typeof createdBy === 'object' && createdBy !== null && '_id' in createdBy) {
    return String((createdBy as { _id: { toString(): string } })._id);
  }
  return String(createdBy);
}

function formatStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    in_review: 'In Review',
    correction: 'Correction',
    qc_approval: 'QC Approval',
    live: 'Live',
  };
  return labels[status] ?? status;
}

function buildReleaseSummary(release: IMusicRelease, extra?: Record<string, string>) {
  return {
    title: release.title,
    artist: release.artist,
    label: release.label,
    status: release.status,
    ...extra,
  };
}

class ReleaseNotificationsService {
  private async findSuperAdminIds(): Promise<string[]> {
    const role = await roleRepository.findBySlug(ROLES.SUPER_ADMIN);
    if (!role) return [];

    const users = await UserModel.find({
      role: role._id,
      status: USER_STATUS.ACTIVE,
    })
      .select('_id')
      .exec();

    return users.map((u) => u._id.toString());
  }

  private buildContentDeliveryRoute(releaseId: string): string {
    return `${CONTENT_DELIVERY_MODULE.route}?entry=${releaseId}`;
  }

  private buildAdminRoute(status: MusicReleaseStatus, releaseId: string): string | null {
    const config = ADMIN_STATUS_MODULES[status];
    if (!config) return null;
    return `${config.route}?entry=${releaseId}`;
  }

  async notifyReleaseCreated(release: IMusicRelease, actor: Actor): Promise<void> {
    if (actor.isSuperAdmin) return;

    try {
      const releaseId = release._id.toString();
      const superAdminIds = await this.findSuperAdminIds();
      if (superAdminIds.length === 0) return;

      const creatorName = actor.name ?? 'Admin';
      const payloads = superAdminIds.map((recipientId) => ({
        recipient: recipientId as never,
        type: NOTIFICATION_TYPE.RELEASE_CREATED,
        moduleSlug: CONTENT_DELIVERY_MODULE.slug,
        moduleName: CONTENT_DELIVERY_MODULE.name,
        entryId: releaseId,
        route: this.buildContentDeliveryRoute(releaseId),
        title: 'New release submitted',
        message: `${creatorName} submitted a new release for review.`,
        entrySummary: buildReleaseSummary(release),
        actor: actor.id as never,
      }));

      await notificationRepository.createMany(payloads);
    } catch (error) {
      logger.error('Failed to notify super admins of new release', { error });
    }
  }

  async notifyReleaseUpdated(
    release: IMusicRelease,
    actor: Actor,
    previousStatus?: MusicReleaseStatus,
  ): Promise<void> {
    if (actor.isSuperAdmin) return;

    try {
      const releaseId = release._id.toString();
      const superAdminIds = await this.findSuperAdminIds();
      if (superAdminIds.length === 0) return;

      const creatorName = actor.name ?? 'Admin';
      const resubmitted = previousStatus === MUSIC_RELEASE_STATUS.CORRECTION;
      const message = resubmitted
        ? `${creatorName} resubmitted a release after correction.`
        : `${creatorName} updated a release submission.`;

      const payloads = superAdminIds.map((recipientId) => ({
        recipient: recipientId as never,
        type: NOTIFICATION_TYPE.RELEASE_UPDATED,
        moduleSlug: CONTENT_DELIVERY_MODULE.slug,
        moduleName: CONTENT_DELIVERY_MODULE.name,
        entryId: releaseId,
        route: this.buildContentDeliveryRoute(releaseId),
        title: resubmitted ? 'Release resubmitted' : 'Release updated',
        message,
        entrySummary: buildReleaseSummary(release, {
          resubmitted: resubmitted ? 'yes' : 'no',
        }),
        actor: actor.id as never,
      }));

      await notificationRepository.createMany(payloads);
    } catch (error) {
      logger.error('Failed to notify super admins of release update', { error });
    }
  }

  async notifyReleaseStatusUpdated(
    release: IMusicRelease,
    newStatus: MusicReleaseStatus,
    actor: Actor,
  ): Promise<void> {
    if (!actor.isSuperAdmin) return;

    const notifyStatuses: MusicReleaseStatus[] = [
      MUSIC_RELEASE_STATUS.CORRECTION,
      MUSIC_RELEASE_STATUS.QC_APPROVAL,
      MUSIC_RELEASE_STATUS.LIVE,
    ];
    if (!notifyStatuses.includes(newStatus)) return;

    try {
      const ownerId = resolveOwnerId(release.createdBy);
      if (!ownerId || ownerId === actor.id) return;

      const moduleConfig = ADMIN_STATUS_MODULES[newStatus];
      if (!moduleConfig) return;

      const releaseId = release._id.toString();
      const route = this.buildAdminRoute(newStatus, releaseId);
      if (!route) return;

      const statusLabel = formatStatusLabel(newStatus);

      await notificationRepository.create({
        recipient: ownerId as never,
        type: NOTIFICATION_TYPE.RELEASE_STATUS_UPDATED,
        moduleSlug: moduleConfig.slug,
        moduleName: moduleConfig.name,
        entryId: releaseId,
        route,
        title: 'Release status updated',
        message: `Your release "${release.title}" status was updated to ${statusLabel}.`,
        entrySummary: buildReleaseSummary(release, { status: newStatus }),
        actor: actor.id as never,
      });
    } catch (error) {
      logger.error('Failed to notify admin of release status update', { error });
    }
  }
}

export const releaseNotificationsService = new ReleaseNotificationsService();
