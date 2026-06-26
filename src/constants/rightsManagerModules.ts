/** Rights Manager child modules — shared by notifications and analytics. */
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

export interface RightsManagerModuleConfig {
  slug: RightsManagerModuleSlug;
  name: string;
  route: string;
  summaryFields: readonly string[];
}

export const RIGHTS_MANAGER_MODULES: Record<RightsManagerModuleSlug, RightsManagerModuleConfig> = {
  'youtube-claim-release': {
    slug: 'youtube-claim-release',
    name: 'Youtube Claim Release',
    route: '/dashboard/legal/right-manager/youtube-claim-release',
    summaryFields: ['senderLabelName', 'receiverLabelName', 'isrcCode'],
  },
  'facebook-claim-release': {
    slug: 'facebook-claim-release',
    name: 'Facebook Claim Release',
    route: '/dashboard/legal/right-manager/facebook-claim-release',
    summaryFields: ['senderLabelName', 'receiverLabelName', 'isrcCode'],
  },
  'content-id': {
    slug: 'content-id',
    name: 'Content ID',
    route: '/dashboard/legal/right-manager/content-id',
    summaryFields: ['labelName', 'isrcCode'],
  },
  oac: {
    slug: 'oac',
    name: 'OAC',
    route: '/dashboard/legal/right-manager/oac',
    summaryFields: ['labelName', 'channelLink'],
  },
  'profile-linking': {
    slug: 'profile-linking',
    name: 'Profile Linking',
    route: '/dashboard/legal/right-manager/profile-linking',
    summaryFields: ['labelName', 'channelLink'],
  },
  allowlist: {
    slug: 'allowlist',
    name: 'Allowlist',
    route: '/dashboard/legal/right-manager/allowlist',
    summaryFields: ['labelName', 'channelLink'],
  },
  'manual-claiming': {
    slug: 'manual-claiming',
    name: 'Manual Claiming',
    route: '/dashboard/legal/right-manager/manual-claiming',
    summaryFields: ['labelName', 'isrcCode'],
  },
  takedown: {
    slug: 'takedown',
    name: 'Takedown',
    route: '/dashboard/legal/right-manager/takedown',
    summaryFields: ['labelName', 'isrcCode'],
  },
};

export function isRightsManagerModuleSlug(slug: string): slug is RightsManagerModuleSlug {
  return (RIGHTS_MANAGER_MODULE_SLUGS as readonly string[]).includes(slug);
}

export function buildEntrySummary(
  moduleSlug: RightsManagerModuleSlug,
  entry: Record<string, unknown>,
): Record<string, string> {
  const config = RIGHTS_MANAGER_MODULES[moduleSlug];
  const summary: Record<string, string> = { status: String(entry.status ?? '') };

  for (const field of config.summaryFields) {
    const value = entry[field];
    if (value != null && value !== '') {
      summary[field] = String(value);
    }
  }

  return summary;
}
