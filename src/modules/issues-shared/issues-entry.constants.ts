export const ISSUES_ENTRY_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type IssuesEntryStatus = (typeof ISSUES_ENTRY_STATUS)[keyof typeof ISSUES_ENTRY_STATUS];

export const ISSUES_ENTRY_OWNERSHIP = {
  YES: 'yes',
  NO: 'no',
} as const;

export type IssuesEntryOwnership =
  | (typeof ISSUES_ENTRY_OWNERSHIP)[keyof typeof ISSUES_ENTRY_OWNERSHIP]
  | '';

export const ISSUES_ENTRY_ASSET_TYPES = [
  'Track',
  'Album',
  'Music Video',
  'Composition',
  'Other',
] as const;

export type IssuesEntryAssetType = (typeof ISSUES_ENTRY_ASSET_TYPES)[number];
