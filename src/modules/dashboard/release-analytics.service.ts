import { musicReleaseRepository } from '@/modules/music-release/music-release.repository';
import {
  MUSIC_RELEASE_STATUS,
  type MusicReleaseStatus,
} from '@/modules/music-release/music-release.constants';
import { ROLES } from '@/constants';
import { buildCreatedByScope } from '@/utils/dataScope';

const DASHBOARD_RELEASE_STATUSES: MusicReleaseStatus[] = [
  MUSIC_RELEASE_STATUS.IN_REVIEW,
  MUSIC_RELEASE_STATUS.TAKEDOWN,
  MUSIC_RELEASE_STATUS.CORRECTION,
  MUSIC_RELEASE_STATUS.QC_APPROVAL,
  MUSIC_RELEASE_STATUS.LIVE,
];

const STATUS_LABELS: Record<MusicReleaseStatus, string> = {
  in_review: 'In Review',
  takedown: 'Takedown',
  correction: 'Correction',
  qc_approval: 'QC Approval',
  live: 'Live',
};

export interface ReleaseStatusCount {
  status: MusicReleaseStatus;
  label: string;
  count: number;
}

export interface ReleaseAnalytics {
  variant: 'admin' | 'content-delivery';
  scopeLabel: string;
  total: number;
  counts: ReleaseStatusCount[];
}

export interface ReleaseAnalyticsBundle {
  admin: ReleaseAnalytics | null;
  contentDelivery: ReleaseAnalytics | null;
}

interface AnalyticsActor {
  userId: string;
  roleSlug: string;
}

function buildCounts(raw: Record<string, number>): ReleaseStatusCount[] {
  return DASHBOARD_RELEASE_STATUSES.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: raw[status] ?? 0,
  }));
}

function sumCounts(counts: ReleaseStatusCount[]): number {
  return counts.reduce((sum, row) => sum + row.count, 0);
}

class ReleaseAnalyticsService {
  async getAnalytics(
    actor: AnalyticsActor,
    options: { includeAdmin: boolean; includeContentDelivery: boolean },
  ): Promise<ReleaseAnalyticsBundle> {
    const isSuperAdmin = actor.roleSlug === ROLES.SUPER_ADMIN;
    const isSubAdmin = actor.roleSlug === ROLES.SUB_ADMIN;

    let admin: ReleaseAnalytics | null = null;
    if (options.includeAdmin && !isSuperAdmin && !isSubAdmin) {
      const raw = await musicReleaseRepository.countByStatus({ createdBy: actor.userId });
      const counts = buildCounts(raw);
      admin = {
        variant: 'admin',
        scopeLabel: 'Your releases',
        total: sumCounts(counts),
        counts,
      };
    }

    let contentDelivery: ReleaseAnalytics | null = null;
    if (options.includeContentDelivery && (isSuperAdmin || isSubAdmin)) {
      const scope = isSuperAdmin
        ? {}
        : await buildCreatedByScope({
            id: actor.userId,
            roleSlug: actor.roleSlug,
            isSuperAdmin: false,
            isSubAdmin: true,
          });
      const raw = await musicReleaseRepository.countByStatus(scope);
      const counts = buildCounts(raw);
      contentDelivery = {
        variant: 'content-delivery',
        scopeLabel: isSuperAdmin ? 'All releases across admins' : 'Releases in your scope',
        total: sumCounts(counts),
        counts,
      };
    }

    return { admin, contentDelivery };
  }
}

export const releaseAnalyticsService = new ReleaseAnalyticsService();
