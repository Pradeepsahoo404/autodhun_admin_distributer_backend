import { musicReleaseRepository } from '@/modules/music-release/music-release.repository';
import {
  MUSIC_RELEASE_STATUS,
  type MusicReleaseStatus,
} from '@/modules/music-release/music-release.constants';
import { isElevatedRole } from '@/utils/roles';
import { createdByFeatureScope, tenantScopeFilter, type TenantActor } from '@/utils/tenantScope';

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
  tenantId: string | null;
  isMasterAdmin?: boolean;
  isSuperAdmin?: boolean;
}

function toTenantActor(actor: AnalyticsActor): TenantActor {
  const elevated = isElevatedRole(actor.roleSlug) || Boolean(actor.isSuperAdmin);
  return {
    id: actor.userId,
    role: actor.roleSlug,
    isSuperAdmin: elevated,
    isMasterAdmin: actor.isMasterAdmin,
    tenantId: actor.tenantId,
  };
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
    const tenantActor = toTenantActor(actor);
    const isSuperAdmin = tenantActor.isSuperAdmin;

    let admin: ReleaseAnalytics | null = null;
    if (options.includeAdmin && !isSuperAdmin) {
      const raw = await musicReleaseRepository.countByStatus(createdByFeatureScope(tenantActor));
      const counts = buildCounts(raw);
      admin = {
        variant: 'admin',
        scopeLabel: 'Your releases',
        total: sumCounts(counts),
        counts,
      };
    }

    let contentDelivery: ReleaseAnalytics | null = null;
    if (options.includeContentDelivery && isSuperAdmin) {
      const raw = await musicReleaseRepository.countByStatus(tenantScopeFilter(tenantActor));
      const counts = buildCounts(raw);
      contentDelivery = {
        variant: 'content-delivery',
        scopeLabel: 'All releases across admins',
        total: sumCounts(counts),
        counts,
      };
    }

    return { admin, contentDelivery };
  }
}

export const releaseAnalyticsService = new ReleaseAnalyticsService();
