/** Issues child modules — shared by notifications and routing. */
export const ISSUES_MODULE_SLUGS = [
  'reference-overlaps',
  'invalid-references',
  'ownership-transfers',
  'potential-claims',
  'disputed-claims',
  'appealed-claims',
] as const;

export type IssuesModuleSlug = (typeof ISSUES_MODULE_SLUGS)[number];

export interface IssuesModuleConfig {
  slug: IssuesModuleSlug;
  name: string;
  route: string;
  apiPath: string;
  summaryFields: readonly string[];
}

export const ISSUES_MODULES: Record<IssuesModuleSlug, IssuesModuleConfig> = {
  'reference-overlaps': {
    slug: 'reference-overlaps',
    name: 'Reference Overlaps',
    route: '/dashboard/issues/reference-overlaps',
    apiPath: '/reference-overlaps',
    summaryFields: ['otherParty', 'assetName', 'isrcCode', 'ownership'],
  },
  'invalid-references': {
    slug: 'invalid-references',
    name: 'Invalid References',
    route: '/dashboard/issues/invalid-references',
    apiPath: '/invalid-references',
    summaryFields: ['otherParty', 'assetName', 'isrcCode', 'ownership'],
  },
  'ownership-transfers': {
    slug: 'ownership-transfers',
    name: 'Ownership Transfers',
    route: '/dashboard/issues/ownership-transfers',
    apiPath: '/ownership-transfers',
    summaryFields: ['otherParty', 'assetName', 'isrcCode', 'ownership'],
  },
  'potential-claims': {
    slug: 'potential-claims',
    name: 'Potential Claims',
    route: '/dashboard/issues/potential-claims',
    apiPath: '/potential-claims',
    summaryFields: ['otherParty', 'assetName', 'isrcCode', 'ownership'],
  },
  'disputed-claims': {
    slug: 'disputed-claims',
    name: 'Disputed Claims',
    route: '/dashboard/issues/disputed-claims',
    apiPath: '/disputed-claims',
    summaryFields: ['otherParty', 'assetName', 'isrcCode', 'ownership'],
  },
  'appealed-claims': {
    slug: 'appealed-claims',
    name: 'Appealed Claims',
    route: '/dashboard/issues/appealed-claims',
    apiPath: '/appealed-claims',
    summaryFields: ['otherParty', 'assetName', 'isrcCode', 'ownership'],
  },
};

export function isIssuesModuleSlug(slug: string): slug is IssuesModuleSlug {
  return (ISSUES_MODULE_SLUGS as readonly string[]).includes(slug);
}

export function buildIssuesEntrySummary(
  moduleSlug: IssuesModuleSlug,
  entry: Record<string, unknown>,
): Record<string, string> {
  const config = ISSUES_MODULES[moduleSlug];
  const summary: Record<string, string> = {};

  if (entry.status != null && entry.status !== '') {
    summary.status = String(entry.status);
  }

  for (const field of config.summaryFields) {
    const value = entry[field];
    if (value != null && value !== '') {
      summary[field] = String(value);
    }
  }

  return summary;
}
