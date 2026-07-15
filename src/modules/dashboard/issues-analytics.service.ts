import { Model } from 'mongoose';
import { ROLES } from '@/constants';
import { buildAssignedToScope } from '@/utils/dataScope';
import {
  ISSUES_MODULES,
  ISSUES_MODULE_SLUGS,
  IssuesModuleSlug,
} from '@/constants/issuesModules';
import { getIssuesEntryModel } from '@/modules/issues-shared/issues-entry.model';
import { ReferenceOverlapModel } from '@/modules/reference-overlaps/reference-overlaps.model';

export const ISSUES_ANALYTICS_MODULE_SLUGS = ISSUES_MODULE_SLUGS;

export type IssuesAnalyticsModuleSlug = IssuesModuleSlug;

export interface IssuesModuleDef {
  slug: IssuesAnalyticsModuleSlug;
  name: string;
  route: string;
  icon: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>;
}

const ISSUES_MODULE_ICONS: Record<IssuesAnalyticsModuleSlug, string> = {
  'reference-overlaps': 'GitMerge',
  'invalid-references': 'FileWarning',
  'ownership-transfers': 'ArrowRightLeft',
  'potential-claims': 'ShieldAlert',
  'disputed-claims': 'Scale',
  'appealed-claims': 'Gavel',
};

export const ISSUES_ANALYTICS_MODULES: IssuesModuleDef[] = ISSUES_MODULE_SLUGS.map((slug) => ({
  slug,
  name: ISSUES_MODULES[slug].name,
  route: ISSUES_MODULES[slug].route,
  icon: ISSUES_MODULE_ICONS[slug],
  model:
    slug === 'reference-overlaps'
      ? ReferenceOverlapModel
      : getIssuesEntryModel(
          {
            'invalid-references': 'InvalidReference',
            'ownership-transfers': 'OwnershipTransfer',
            'potential-claims': 'PotentialClaim',
            'disputed-claims': 'DisputedClaim',
            'appealed-claims': 'AppealedClaim',
          }[slug],
        ),
}));

export interface IssuesModuleStats {
  slug: IssuesAnalyticsModuleSlug;
  name: string;
  route: string;
  icon: string;
  total: number;
  active: number;
  inactive: number;
  ownershipPending: number;
  last7Days: number;
  last30Days: number;
}

export interface IssuesAnalyticsSummary {
  total: number;
  active: number;
  inactive: number;
  ownershipPending: number;
  last7Days: number;
  last30Days: number;
}

export interface IssuesAnalytics {
  isSuperAdmin: boolean;
  scopeLabel: string;
  summary: IssuesAnalyticsSummary;
  modules: IssuesModuleStats[];
  dailyTrend7: number[];
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
): Promise<Omit<IssuesModuleStats, 'slug' | 'name' | 'route' | 'icon'>> {
  const last7 = daysAgo(7);
  const last30 = daysAgo(30);

  const [total, active, inactive, ownershipPending, last7Days, last30Days] = await Promise.all([
    model.countDocuments(scope),
    model.countDocuments({ ...scope, status: 'active' }),
    model.countDocuments({ ...scope, status: 'inactive' }),
    model.countDocuments({ ...scope, ownership: '' }),
    model.countDocuments({ ...scope, createdAt: { $gte: last7 } }),
    model.countDocuments({ ...scope, createdAt: { $gte: last30 } }),
  ]);

  return { total, active, inactive, ownershipPending, last7Days, last30Days };
}

async function getDailyTrend(
  modules: IssuesModuleDef[],
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

class IssuesAnalyticsService {
  async getAnalytics(
    actor: Actor,
    visibleSlugs: IssuesAnalyticsModuleSlug[],
  ): Promise<IssuesAnalytics | null> {
    if (visibleSlugs.length === 0) return null;

    const isSuperAdmin = actor.roleSlug === ROLES.SUPER_ADMIN;
    const isSubAdmin = actor.roleSlug === ROLES.SUB_ADMIN;
    const scope = isSuperAdmin
      ? {}
      : await buildAssignedToScope({
          id: actor.userId,
          roleSlug: actor.roleSlug,
          isSuperAdmin: false,
          isSubAdmin,
        });
    const slugSet = new Set(visibleSlugs);

    const modulesToQuery = ISSUES_ANALYTICS_MODULES.filter((mod) => slugSet.has(mod.slug));

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

    const summary = moduleStats.reduce<IssuesAnalyticsSummary>(
      (acc, mod) => ({
        total: acc.total + mod.total,
        active: acc.active + mod.active,
        inactive: acc.inactive + mod.inactive,
        ownershipPending: acc.ownershipPending + mod.ownershipPending,
        last7Days: acc.last7Days + mod.last7Days,
        last30Days: acc.last30Days + mod.last30Days,
      }),
      { total: 0, active: 0, inactive: 0, ownershipPending: 0, last7Days: 0, last30Days: 0 },
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
          : 'Entries assigned to you',
      summary,
      modules: moduleStats,
      dailyTrend7,
      dailyTrend30,
    };
  }
}

export const issuesAnalyticsService = new IssuesAnalyticsService();
