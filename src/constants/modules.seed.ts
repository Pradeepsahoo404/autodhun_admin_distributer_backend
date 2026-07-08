/**
 * Default modules that drive the dynamic sidebar and permission matrix.
 * The seeder upserts these by `slug`, so editing this list is the single
 * source of truth for what modules exist in a fresh deployment.
 *
 * `group`:
 *   - 'main'       → product modules shown in the primary sidebar
 *   - 'management' → Super-Admin RBAC tooling (users/roles/modules/permissions)
 *
 * `parentSlug` — optional; builds collapsible nested navigation in the sidebar.
 */
export type ModuleAudience = 'shared' | 'super-admin' | 'admin';

export interface ModuleSeed {
  name: string;
  slug: string;
  route: string;
  icon: string;
  order: number;
  isActive: boolean;
  isPro: boolean;
  group: 'main' | 'management';
  parentSlug?: string;
  /** Root modules only — controls which role sees this branch in the sidebar. */
  audience?: ModuleAudience;
}

const m = (
  name: string,
  slug: string,
  route: string,
  icon: string,
  order: number,
  opts?: Partial<Pick<ModuleSeed, 'parentSlug' | 'isPro' | 'group' | 'audience'>>,
): ModuleSeed => ({
  name,
  slug,
  route,
  icon,
  order,
  isActive: true,
  isPro: false,
  group: 'main',
  ...opts,
});

/** Legacy music modules — deactivated on re-seed. */
export const DEPRECATED_MODULE_SLUGS = [
  'releases',
  'finance',
  'playlist-pitches',
  'express-ads',
  'artist-growth',
  'publishing',
  'ai-studio',
  'sync-licensing',
] as const;

export const DEFAULT_MODULES: ModuleSeed[] = [
  // ── Shared ──────────────────────────────────────────────────────────────
  m('Dashboard', 'dashboard', '/dashboard', 'LayoutDashboard', 1),

  // ── Super Admin: Active Accounts ───────────────────────────────────────
  m('Active Accounts', 'active-accounts', '/dashboard/active-accounts/active', 'Users', 10, {
    audience: 'super-admin',
  }),
  m('Active Account', 'active-account', '/dashboard/active-accounts/active', 'UserCheck', 11, {
    parentSlug: 'active-accounts',
  }),
  m('Deactive Account', 'deactive-account', '/dashboard/active-accounts/deactive', 'UserX', 12, {
    parentSlug: 'active-accounts',
  }),

  // ── Super Admin: Assets (grouped) ───────────────────────────────────────
  m('Assets', 'assets-group', '/dashboard/assets/overview', 'Package', 20, { audience: 'super-admin' }),
  m('Overview', 'assets-overview', '/dashboard/assets/overview', 'Package', 21, { parentSlug: 'assets-group' }),
  m('Label Transfer', 'label-transfer', '/dashboard/assets/label-transfer', 'ArrowLeftRight', 22, {
    parentSlug: 'assets-group',
  }),
  m('Label Block', 'label-block', '/dashboard/assets/label-block', 'Ban', 23, { parentSlug: 'assets-group' }),
  m('Label Update', 'label-update', '/dashboard/assets/label-update', 'RefreshCw', 24, { parentSlug: 'assets-group' }),

  // ── Super Admin only ────────────────────────────────────────────────────
  m('Content Delivery', 'content-delivery', '/dashboard/content-delivery', 'Truck', 30, {
    audience: 'super-admin',
  }),

  // ── Admin: Release ──────────────────────────────────────────────────────
  m('Release', 'release', '/dashboard/release/create', 'Disc3', 40, { audience: 'admin' }),
  m('Create New Release', 'create-new-release', '/dashboard/release/create', 'PlusCircle', 41, {
    parentSlug: 'release',
  }),
  m('Correction', 'release-correction', '/dashboard/release/correction', 'FilePen', 42, { parentSlug: 'release' }),

  // ── Admin: Assets (single page) ─────────────────────────────────────────
  m('Assets', 'assets', '/dashboard/assets', 'Package', 50, { audience: 'admin' }),

  // ── Shared modules ──────────────────────────────────────────────────────
  m('Analytics', 'analytics', '/dashboard/analytics', 'BarChart3', 60),

  // ── Issues ─────────────────────────────────────────────────────────────
  m('Issues', 'issues', '/dashboard/issues/reference-overlaps', 'AlertTriangle', 70),
  m('Reference Overlaps', 'reference-overlaps', '/dashboard/issues/reference-overlaps', 'GitMerge', 71, {
    parentSlug: 'issues',
  }),
  m('Invalid References', 'invalid-references', '/dashboard/issues/invalid-references', 'FileWarning', 72, {
    parentSlug: 'issues',
  }),
  m('Ownership Transfers', 'ownership-transfers', '/dashboard/issues/ownership-transfers', 'ArrowRightLeft', 73, {
    parentSlug: 'issues',
  }),
  m('Potential Claims', 'potential-claims', '/dashboard/issues/potential-claims', 'ShieldAlert', 74, {
    parentSlug: 'issues',
  }),
  m('Disputed Claims', 'disputed-claims', '/dashboard/issues/disputed-claims', 'Scale', 75, { parentSlug: 'issues' }),
  m('Appealed Claims', 'appealed-claims', '/dashboard/issues/appealed-claims', 'Gavel', 76, { parentSlug: 'issues' }),

  // ── Reports ─────────────────────────────────────────────────────────────
  m('Reports', 'reports', '/dashboard/reports/report', 'FileText', 80),
  m('Report', 'report', '/dashboard/reports/report', 'FileText', 81, { parentSlug: 'reports' }),
  m('Statements', 'statements', '/dashboard/reports/statements', 'Receipt', 82, { parentSlug: 'reports' }),
  m('Withdrawals', 'withdrawals', '/dashboard/reports/withdrawals', 'Wallet', 83, { parentSlug: 'reports' }),

  // ── Channels ────────────────────────────────────────────────────────────
  m('Channels', 'channels', '/dashboard/channels/linking', 'Radio', 90),
  m('Linking', 'channel-linking', '/dashboard/channels/linking', 'Link', 91, { parentSlug: 'channels' }),
  m('Create Channel', 'create-channel', '/dashboard/channels/create', 'Plus', 92, { parentSlug: 'channels' }),

  // ── Legal → Rights Manager ─────────────────────────────────────────────
  m('Legal', 'legal', '/dashboard/legal/right-manager/youtube-claim-release', 'Scale', 100),
  m('Rights Manager', 'right-manager', '/dashboard/legal/right-manager/youtube-claim-release', 'Shield', 101, {
    parentSlug: 'legal',
  }),
  m('Youtube Claim Release', 'youtube-claim-release', '/dashboard/legal/right-manager/youtube-claim-release', 'Youtube', 102, {
    parentSlug: 'right-manager',
  }),
  m('Facebook Claim Release', 'facebook-claim-release', '/dashboard/legal/right-manager/facebook-claim-release', 'Facebook', 103, {
    parentSlug: 'right-manager',
  }),
  m('Content ID', 'content-id', '/dashboard/legal/right-manager/content-id', 'Fingerprint', 104, {
    parentSlug: 'right-manager',
  }),
  m('OAC', 'oac', '/dashboard/legal/right-manager/oac', 'BadgeCheck', 105, { parentSlug: 'right-manager' }),
  m('Profile Linking', 'profile-linking', '/dashboard/legal/right-manager/profile-linking', 'UserRound', 106, {
    parentSlug: 'right-manager',
  }),
  m('Allowlist', 'allowlist', '/dashboard/legal/right-manager/allowlist', 'ListChecks', 107, { parentSlug: 'right-manager' }),
  m('Manual Claiming', 'manual-claiming', '/dashboard/legal/right-manager/manual-claiming', 'Hand', 108, {
    parentSlug: 'right-manager',
  }),
  m('Takedown', 'takedown', '/dashboard/legal/right-manager/takedown', 'Trash2', 109, { parentSlug: 'right-manager' }),

  // ── Notifications (header bell + optional page; permissions on root module) ──
  m('Notifications', 'notifications', '/dashboard/notifications', 'Bell', 195),

  // ── Unchanged ───────────────────────────────────────────────────────────
  m('Settings', 'settings', '/dashboard/settings', 'Settings', 200),
  m('Help Support', 'help-support', '/dashboard/help-support', 'LifeBuoy', 210),

  // ── Management (Super Admin) ────────────────────────────────────────────
  m('Users', 'users', '/dashboard/users', 'Users', 300, { group: 'management', audience: 'super-admin' }),
  m('Roles', 'roles', '/dashboard/roles', 'ShieldCheck', 310, { group: 'management', audience: 'super-admin' }),
  m('Modules', 'modules', '/dashboard/modules', 'Boxes', 320, { group: 'management', audience: 'super-admin' }),
  m('Permissions', 'permissions', '/dashboard/permissions', 'KeyRound', 330, {
    group: 'management',
    audience: 'super-admin',
  }),
];

/** Slugs the Admin role can view out-of-the-box (root modules only). Child modules inherit. */
export const ADMIN_DEFAULT_MODULE_SLUGS = [
  'dashboard',
  'release',
  'assets',
  'analytics',
  'issues',
  'reports',
  'channels',
  'legal',
  'notifications',
  'settings',
  'help-support',
] as const;

/** Root modules where Admin also gets create / update / delete by default. */
export const ADMIN_DEFAULT_CRUD_MODULE_SLUGS = ['legal', 'release', 'channels'] as const;
