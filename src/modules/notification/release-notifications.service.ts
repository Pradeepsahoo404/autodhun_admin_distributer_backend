import { env } from '@/config/env';
import { IMusicRelease } from '@/modules/music-release/music-release.model';
import {
  MUSIC_RELEASE_STATUS,
  type MusicReleaseStatus,
} from '@/modules/music-release/music-release.constants';
import { NOTIFICATION_TYPE } from './notification.model';
import { notificationRepository } from './notification.repository';
import { buildReleaseStatusUpdateEmail, sendMail } from '@/utils/email';
import { findElevatedRecipientIds } from '@/utils/elevatedRecipients';
import { logger } from '@/config/logger';

interface Actor {
  id: string;
  isSuperAdmin: boolean;
  name?: string;
  tenantId?: string | null;
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
  [MUSIC_RELEASE_STATUS.TAKEDOWN]: {
    slug: 'assets',
    name: 'Assets',
    route: '/dashboard/assets',
  },
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

function resolveOwner(createdBy: unknown): { id: string; name: string; email: string } | null {
  if (!createdBy || typeof createdBy !== 'object' || !('_id' in createdBy)) return null;

  const owner = createdBy as { _id: { toString(): string }; name?: string; email?: string };
  const email = owner.email?.trim();
  if (!email) return null;

  return {
    id: owner._id.toString(),
    name: owner.name?.trim() || 'Admin',
    email,
  };
}

function formatStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    in_review: 'In Review',
    takedown: 'Takedown',
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
  private findSuperAdminIds(tenantId?: string | null): Promise<string[]> {
    return findElevatedRecipientIds(tenantId);
  }

  private buildContentDeliveryRoute(releaseId: string): string {
    return `${CONTENT_DELIVERY_MODULE.route}?entry=${releaseId}`;
  }

  private buildAdminRoute(status: MusicReleaseStatus, releaseId: string): string | null {
    const config = ADMIN_STATUS_MODULES[status];
    if (!config) return null;
    return `${config.route}?entry=${releaseId}`;
  }

  private buildCreatorDashboardUrl(status: MusicReleaseStatus, releaseId: string): string {
    const base = env.CLIENT_URL.replace(/\/$/, '');

    if (status === MUSIC_RELEASE_STATUS.CORRECTION) {
      return `${base}/dashboard/release/correction?entry=${releaseId}`;
    }

    if (status === MUSIC_RELEASE_STATUS.TAKEDOWN) {
      return `${base}/dashboard/assets?entry=${releaseId}`;
    }

    if (status === MUSIC_RELEASE_STATUS.QC_APPROVAL || status === MUSIC_RELEASE_STATUS.LIVE) {
      return `${base}/dashboard/assets/overview?entry=${releaseId}`;
    }

    return `${base}/dashboard`;
  }

  private async sendReleaseStatusEmail(
    release: IMusicRelease,
    newStatus: MusicReleaseStatus,
    owner: { name: string; email: string },
    correctionReasons?: string[],
  ): Promise<void> {
    const statusLabel = formatStatusLabel(newStatus);
    const isrc = release.tracks?.[0]?.isrc?.trim();
    const reasons = correctionReasons ?? release.correctionReasons ?? [];

    const { subject, html, text } = buildReleaseStatusUpdateEmail({
      recipientName: owner.name,
      releaseTitle: release.title,
      artist: release.artist,
      label: release.label,
      statusKey: newStatus,
      statusLabel,
      dashboardUrl: this.buildCreatorDashboardUrl(newStatus, release._id.toString()),
      isrc: isrc || undefined,
      correctionReasons: reasons.length ? reasons : undefined,
    });

    await sendMail({ to: owner.email, subject, html, text });
  }

  async notifyReleaseCreated(release: IMusicRelease, actor: Actor): Promise<void> {
    if (actor.isSuperAdmin) return;

    try {
      const releaseId = release._id.toString();
      const superAdminIds = await this.findSuperAdminIds(actor.tenantId);
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
      const superAdminIds = await this.findSuperAdminIds(actor.tenantId);
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
    options?: { correctionReasons?: string[] },
  ): Promise<void> {
    if (!actor.isSuperAdmin) return;

    const owner = resolveOwner(release.createdBy);
    if (!owner || owner.id === actor.id) return;

    const statusLabel = formatStatusLabel(newStatus);
    const releaseId = release._id.toString();
    const correctionReasons = options?.correctionReasons ?? release.correctionReasons;

    try {
      await this.sendReleaseStatusEmail(release, newStatus, owner, correctionReasons);
    } catch (error) {
      logger.error('Failed to email creator of release status update', {
        releaseId,
        newStatus,
        error,
      });
    }

    const notifyStatuses: MusicReleaseStatus[] = [
      MUSIC_RELEASE_STATUS.TAKEDOWN,
      MUSIC_RELEASE_STATUS.CORRECTION,
      MUSIC_RELEASE_STATUS.QC_APPROVAL,
      MUSIC_RELEASE_STATUS.LIVE,
    ];
    if (!notifyStatuses.includes(newStatus)) return;

    try {
      const moduleConfig = ADMIN_STATUS_MODULES[newStatus];
      if (!moduleConfig) return;

      const route = this.buildAdminRoute(newStatus, releaseId);
      if (!route) return;

      await notificationRepository.create({
        recipient: owner.id as never,
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
