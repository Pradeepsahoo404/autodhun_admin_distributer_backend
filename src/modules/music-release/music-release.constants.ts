export const MUSIC_RELEASE_STATUS = {
  IN_REVIEW: 'in_review',
  CORRECTION: 'correction',
  QC_APPROVAL: 'qc_approval',
  LIVE: 'live',
} as const;

export type MusicReleaseStatus = (typeof MUSIC_RELEASE_STATUS)[keyof typeof MUSIC_RELEASE_STATUS];

export const MUSIC_RELEASE_STATUS_VALUES = Object.values(MUSIC_RELEASE_STATUS);

/** Only Super Admin may set these statuses. */
export const SUPER_ADMIN_ONLY_STATUSES: MusicReleaseStatus[] = [
  MUSIC_RELEASE_STATUS.QC_APPROVAL,
  MUSIC_RELEASE_STATUS.LIVE,
];

export const MUSIC_RELEASE_LIST_CONTEXT = {
  ASSETS: 'assets',
  ASSETS_OVERVIEW: 'assets-overview',
  CORRECTION: 'correction',
  CONTENT_DELIVERY: 'content-delivery',
} as const;

/** Shown in Content Delivery — active review pipeline only. */
export const CONTENT_DELIVERY_STATUSES: MusicReleaseStatus[] = [
  MUSIC_RELEASE_STATUS.IN_REVIEW,
  MUSIC_RELEASE_STATUS.CORRECTION,
];

/** Shown in Assets > Overview for Super Admin after approval. */
export const ASSETS_OVERVIEW_STATUSES: MusicReleaseStatus[] = [
  MUSIC_RELEASE_STATUS.QC_APPROVAL,
  MUSIC_RELEASE_STATUS.LIVE,
];

export type MusicReleaseListContext =
  (typeof MUSIC_RELEASE_LIST_CONTEXT)[keyof typeof MUSIC_RELEASE_LIST_CONTEXT];

export const CONTEXT_MODULE_MAP: Record<MusicReleaseListContext, string> = {
  assets: 'assets',
  'assets-overview': 'assets-overview',
  correction: 'release-correction',
  'content-delivery': 'content-delivery',
};
