import { permissionService } from '@/modules/permission/permission.service';
import { PermissionAction } from '@/constants';
import { ResolvedModulePermission } from '@/types';
import { DASHBOARD_CARDS, QUICK_ACTIONS, DashboardCardDef, QuickActionDef } from './dashboard.constants';
import {
  RIGHTS_MANAGER_MODULE_SLUGS,
  RightsManagerAnalytics,
  RightsManagerModuleSlug,
  rightsManagerAnalyticsService,
} from './rights-manager-analytics.service';
import {
  ISSUES_ANALYTICS_MODULE_SLUGS,
  IssuesAnalytics,
  IssuesAnalyticsModuleSlug,
  issuesAnalyticsService,
} from './issues-analytics.service';

export interface DashboardResponse {
  earnings: number;
  currency: string;
  cards: Array<Omit<DashboardCardDef, 'module' | 'requiredAction'>>;
  quickActions: Array<Omit<QuickActionDef, 'module' | 'requiredAction'>>;
  modules: ResolvedModulePermission[];
  permissions: Record<string, { canView: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }>;
  rightsManagerAnalytics: RightsManagerAnalytics | null;
  issuesAnalytics: IssuesAnalytics | null;
}

class DashboardService {
  /**
   * Builds the entire dashboard payload for a user, filtered by their resolved
   * permissions. The frontend renders sidebar, cards and quick actions purely
   * from this response — no hardcoded role logic on the client.
   */
  async getDashboard(roleId: string, roleSlug: string, userId: string): Promise<DashboardResponse> {
    const modules = await permissionService.resolveForRole(roleId, roleSlug);

    // Fast lookup map of slug -> action flags.
    const permMap = new Map<string, ResolvedModulePermission>();
    modules.forEach((m) => permMap.set(m.slug, m));

    const has = (slug: string, action: PermissionAction): boolean => {
      const mod = permMap.get(slug);
      if (!mod) return false;
      const map: Record<PermissionAction, boolean> = {
        view: mod.canView,
        create: mod.canCreate,
        update: mod.canUpdate,
        delete: mod.canDelete,
      };
      return map[action];
    };

    const cards = DASHBOARD_CARDS.filter((c) => has(c.module, c.requiredAction)).map(
      ({ module: _m, requiredAction: _a, ...rest }) => rest,
    );

    const quickActions = QUICK_ACTIONS.filter((q) => has(q.module, q.requiredAction)).map(
      ({ module: _m, requiredAction: _a, ...rest }) => rest,
    );

    const permissions = modules.reduce<DashboardResponse['permissions']>((acc, m) => {
      acc[m.slug] = {
        canView: m.canView,
        canCreate: m.canCreate,
        canUpdate: m.canUpdate,
        canDelete: m.canDelete,
      };
      return acc;
    }, {});

    const visibleRightsManagerSlugs = RIGHTS_MANAGER_MODULE_SLUGS.filter((slug) =>
      has(slug, 'view'),
    ) as RightsManagerModuleSlug[];

    const rightsManagerAnalytics = await rightsManagerAnalyticsService.getAnalytics(
      { userId, roleSlug },
      visibleRightsManagerSlugs,
    );

    const visibleIssuesSlugs = ISSUES_ANALYTICS_MODULE_SLUGS.filter((slug) =>
      has(slug, 'view'),
    ) as IssuesAnalyticsModuleSlug[];

    const issuesAnalytics = await issuesAnalyticsService.getAnalytics(
      { userId, roleSlug },
      visibleIssuesSlugs,
    );

    return {
      earnings: 0, // Wire to a real earnings/payments source when available.
      currency: 'INR',
      cards,
      quickActions,
      modules,
      permissions,
      rightsManagerAnalytics,
      issuesAnalytics,
    };
  }
}

export const dashboardService = new DashboardService();
