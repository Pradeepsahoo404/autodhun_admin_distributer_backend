import { Model } from 'mongoose';
import { ROLES } from '@/constants';
import { buildCreatedByScope } from '@/utils/dataScope';
import { YoutubeClaimReleaseModel } from '@/modules/youtube-claim-release/youtube-claim-release.model';
import { FacebookClaimReleaseModel } from '@/modules/facebook-claim-release/facebook-claim-release.model';
import { ContentIdModel } from '@/modules/content-id/content-id.model';
import { OacModel } from '@/modules/oac/oac.model';
import { ProfileLinkingModel } from '@/modules/profile-linking/profile-linking.model';
import { AllowlistModel } from '@/modules/allowlist/allowlist.model';
import { ManualClaimingModel } from '@/modules/manual-claiming/manual-claiming.model';
import { TakedownModel } from '@/modules/takedown/takedown.model';

export const RIGHTS_MANAGER_MODULE_SLUGS = [
  'youtube-claim-release',
  'facebook-claim-release',
  'content-id',
  'oac',
  'profile-linking',
  'allowlist',
  'manual-claiming',
  'takedown',
] as const;

export type RightsManagerModuleSlug = (typeof RIGHTS_MANAGER_MODULE_SLUGS)[number];

export interface RightsManagerModuleDef {
  slug: RightsManagerModuleSlug;
  name: string;
  route: string;
  icon: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>;
}

export const RIGHTS_MANAGER_MODULES: RightsManagerModuleDef[] = [
  {
    slug: 'youtube-claim-release',
    name: 'Youtube Claim Release',
    route: '/dashboard/legal/right-manager/youtube-claim-release',
    icon: 'Youtube',
    model: YoutubeClaimReleaseModel,
  },
  {
    slug: 'facebook-claim-release',
    name: 'Facebook Claim Release',
    route: '/dashboard/legal/right-manager/facebook-claim-release',
    icon: 'Facebook',
    model: FacebookClaimReleaseModel,
  },
  {
    slug: 'content-id',
    name: 'Content ID',
    route: '/dashboard/legal/right-manager/content-id',
    icon: 'Fingerprint',
    model: ContentIdModel,
  },
  {
    slug: 'oac',
    name: 'OAC',
    route: '/dashboard/legal/right-manager/oac',
    icon: 'BadgeCheck',
    model: OacModel,
  },
  {
    slug: 'profile-linking',
    name: 'Profile Linking',
    route: '/dashboard/legal/right-manager/profile-linking',
    icon: 'UserRound',
    model: ProfileLinkingModel,
  },
  {
    slug: 'allowlist',
    name: 'Allowlist',
    route: '/dashboard/legal/right-manager/allowlist',
    icon: 'ListChecks',
    model: AllowlistModel,
  },
  {
    slug: 'manual-claiming',
    name: 'Manual Claiming',
    route: '/dashboard/legal/right-manager/manual-claiming',
    icon: 'Hand',
    model: ManualClaimingModel,
  },
  {
    slug: 'takedown',
    name: 'Takedown',
    route: '/dashboard/legal/right-manager/takedown',
    icon: 'Trash2',
    model: TakedownModel,
  },
];

export interface RightsManagerModuleStats {
  slug: RightsManagerModuleSlug;
  name: string;
  route: string;
  icon: string;
  total: number;
  active: number;
  inactive: number;
  inProgress: number;
  last7Days: number;
  last30Days: number;
}

export interface RightsManagerAnalyticsSummary {
  total: number;
  active: number;
  inactive: number;
  inProgress: number;
  last7Days: number;
  last30Days: number;
}

export interface RightsManagerAnalytics {
  isSuperAdmin: boolean;
  scopeLabel: string;
  summary: RightsManagerAnalyticsSummary;
  modules: RightsManagerModuleStats[];
  /** Daily entry counts for the last 7 days (oldest → newest). */
  dailyTrend7: number[];
  /** Daily entry counts for the last 30 days (oldest → newest). */
  dailyTrend30: number[];
}

interface Actor {
  userId: string;
  roleSlug: string;
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function countModuleStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>,
  scope: Record<string, unknown>,
): Promise<Omit<RightsManagerModuleStats, 'slug' | 'name' | 'route' | 'icon'>> {
  const last7 = daysAgo(7);
  const last30 = daysAgo(30);

  const [total, active, inactive, inProgress, last7Days, last30Days] = await Promise.all([
    model.countDocuments(scope),
    model.countDocuments({ ...scope, status: 'active' }),
    model.countDocuments({ ...scope, status: 'inactive' }),
    model.countDocuments({ ...scope, status: 'in_progress' }),
    model.countDocuments({ ...scope, createdAt: { $gte: last7 } }),
    model.countDocuments({ ...scope, createdAt: { $gte: last30 } }),
  ]);

  return { total, active, inactive, inProgress, last7Days, last30Days };
}

async function getDailyTrend(
  modules: RightsManagerModuleDef[],
  scope: Record<string, unknown>,
  days = 7,
): Promise<number[]> {
  const trend: number[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const start = daysAgo(i);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const dayCounts = await Promise.all(
      modules.map((mod) =>
        mod.model.countDocuments({
          ...scope,
          createdAt: { $gte: start, $lte: end },
        }),
      ),
    );
    trend.push(dayCounts.reduce((sum, count) => sum + count, 0));
  }

  return trend;
}

class RightsManagerAnalyticsService {
  async getAnalytics(
    actor: Actor,
    visibleSlugs: RightsManagerModuleSlug[],
  ): Promise<RightsManagerAnalytics | null> {
    if (visibleSlugs.length === 0) return null;

    const isSuperAdmin = actor.roleSlug === ROLES.SUPER_ADMIN;
    const isSubAdmin = actor.roleSlug === ROLES.SUB_ADMIN;
    const scope = isSuperAdmin
      ? {}
      : await buildCreatedByScope({
          id: actor.userId,
          roleSlug: actor.roleSlug,
          isSuperAdmin: false,
          isSubAdmin,
        });
    const slugSet = new Set(visibleSlugs);

    const modulesToQuery = RIGHTS_MANAGER_MODULES.filter((mod) => slugSet.has(mod.slug));

    const moduleStats = await Promise.all(
      modulesToQuery.map(async (mod) => {
        const counts = await countModuleStats(mod.model, scope);
        return {
          slug: mod.slug,
          name: mod.name,
          route: mod.route,
          icon: mod.icon,
          ...counts,
        };
      }),
    );

    const summary = moduleStats.reduce<RightsManagerAnalyticsSummary>(
      (acc, mod) => ({
        total: acc.total + mod.total,
        active: acc.active + mod.active,
        inactive: acc.inactive + mod.inactive,
        inProgress: acc.inProgress + mod.inProgress,
        last7Days: acc.last7Days + mod.last7Days,
        last30Days: acc.last30Days + mod.last30Days,
      }),
      { total: 0, active: 0, inactive: 0, inProgress: 0, last7Days: 0, last30Days: 0 },
    );

    const [dailyTrend7, dailyTrend30] = await Promise.all([
      getDailyTrend(modulesToQuery, scope, 7),
      getDailyTrend(modulesToQuery, scope, 30),
    ]);

    return {
      isSuperAdmin,
      scopeLabel: isSuperAdmin
        ? 'All entries across admins'
        : isSubAdmin
          ? 'Entries in your scope'
          : 'Your submitted entries',
      summary,
      modules: moduleStats,
      dailyTrend7,
      dailyTrend30,
    };
  }
}

export const rightsManagerAnalyticsService = new RightsManagerAnalyticsService();
