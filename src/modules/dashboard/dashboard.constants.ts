import { PermissionAction } from '@/constants';

/**
 * Declarative dashboard widget catalog. Each card/action is tied to a module
 * slug + required action; the service filters this list against the requesting
 * user's resolved permissions so the frontend renders only what is allowed.
 */
export interface DashboardCardDef {
  key: string;
  title: string;
  description: string;
  badge?: string;
  variant: 'feature' | 'popular' | 'new-feature' | 'earnings' | 'link' | 'sync';
  cta?: { label: string; action: PermissionAction; moduleSlug: string };
  secondaryCta?: { label: string };
  module: string;
  requiredAction: PermissionAction;
}

export interface QuickActionDef {
  key: string;
  label: string;
  icon: string;
  module: string;
  requiredAction: PermissionAction;
}

export const DASHBOARD_CARDS: DashboardCardDef[] = [
  {
    key: 'release-music',
    title: 'Firsts are always special',
    description: "When you've got the beats right, there's no fun in keeping the world waiting.",
    variant: 'feature',
    cta: { label: 'Create Release', action: 'create', moduleSlug: 'create-new-release' },
    module: 'create-new-release',
    requiredAction: 'view',
  },
  {
    key: 'content-delivery',
    title: 'Content delivery at scale',
    description: 'Monitor pipelines and ensure your catalog reaches every platform on time.',
    badge: 'POPULAR',
    variant: 'popular',
    cta: { label: 'Open delivery', action: 'view', moduleSlug: 'content-delivery' },
    module: 'content-delivery',
    requiredAction: 'view',
  },
  {
    key: 'analytics',
    title: 'Channel analytics',
    description:
      'Track performance across releases, channels, and territories with built-in analytics.',
    badge: 'NEW FEATURE',
    variant: 'new-feature',
    cta: { label: 'View analytics', action: 'view', moduleSlug: 'analytics' },
    module: 'analytics',
    requiredAction: 'view',
  },
  {
    key: 'total-earnings',
    title: 'Total Earnings',
    description: 'This is your available cash-out amount. Check statements for full royalty breakdowns.',
    badge: 'TOTAL EARNINGS',
    variant: 'earnings',
    cta: { label: 'Cash Out', action: 'update', moduleSlug: 'withdrawals' },
    secondaryCta: { label: 'View Breakdown' },
    module: 'withdrawals',
    requiredAction: 'view',
  },
  {
    key: 'channels',
    title: 'Grow your channels',
    description: 'Link existing channels or create new ones to expand your distribution footprint.',
    badge: 'NEW',
    variant: 'link',
    cta: { label: 'Link channel', action: 'create', moduleSlug: 'channel-linking' },
    module: 'channel-linking',
    requiredAction: 'view',
  },
  {
    key: 'rights-manager',
    title: 'Rights Manager',
    description: 'Manage claims, allowlists, takedowns, and platform rights from one place.',
    badge: 'NEW',
    variant: 'sync',
    cta: { label: 'Open Rights Manager', action: 'view', moduleSlug: 'right-manager' },
    module: 'right-manager',
    requiredAction: 'view',
  },
  {
    key: 'issues',
    title: 'Issues',
    description: 'Track reference overlaps, claims, and ownership reviews across all issue types.',
    badge: 'NEW',
    variant: 'sync',
    cta: { label: 'Open Issues', action: 'view', moduleSlug: 'issues' },
    module: 'issues',
    requiredAction: 'view',
  },
];

export const QUICK_ACTIONS: QuickActionDef[] = [
  { key: 'create-release', label: 'Create Release', icon: 'PlusCircle', module: 'create-new-release', requiredAction: 'create' },
  { key: 'view-analytics', label: 'View Analytics', icon: 'BarChart3', module: 'analytics', requiredAction: 'view' },
  { key: 'reports', label: 'Reports', icon: 'FileText', module: 'report', requiredAction: 'view' },
  { key: 'channels', label: 'Channels', icon: 'Radio', module: 'channel-linking', requiredAction: 'view' },
  { key: 'issues', label: 'Issues', icon: 'AlertTriangle', module: 'issues', requiredAction: 'view' },
  { key: 'statements', label: 'Statements', icon: 'Receipt', module: 'statements', requiredAction: 'view' },
];
