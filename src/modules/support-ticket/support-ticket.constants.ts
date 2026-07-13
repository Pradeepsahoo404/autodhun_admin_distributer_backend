export const SUPPORT_TICKET_STATUS = {
  IN_PROGRESS: 'in_progress',
  OPEN: 'open',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

export type SupportTicketStatus =
  (typeof SUPPORT_TICKET_STATUS)[keyof typeof SUPPORT_TICKET_STATUS];

export const SUPPORT_TICKET_CATEGORY = {
  PAYMENT_AND_BILLING: 'payment_and_billing',
  ROYALTIES: 'royalties',
  FEATURES_AND_SERVICES: 'features_and_services',
  GENERAL_AND_OTHER: 'general_and_other_queries',
  EXPRESS_SUPPORT: 'express_support',
} as const;

export type SupportTicketCategory =
  (typeof SUPPORT_TICKET_CATEGORY)[keyof typeof SUPPORT_TICKET_CATEGORY];

export const SUPPORT_TICKET_ISSUE_TYPE = {
  PLAN_PAYMENT_NOT_REFLECTING_DISTRIBUTION: 'plan_payment_not_reflecting_distribution',
  PLAN_PAYMENT_NOT_REFLECTING_PUBLISHING: 'plan_payment_not_reflecting_publishing',
  PAYMENT_MODE_NOT_WORKING: 'payment_mode_not_working',
  NOT_ABLE_TO_CASHOUT: 'not_able_to_cashout',
  CASHOUT_DONE_ROYALTIES_NOT_RECEIVED: 'cashout_done_royalties_not_received',
  INCORRECT_ROYALTY_CALCULATION: 'incorrect_royalty_calculation',
  PRE_SAVE_LINKS: 'pre_save_links',
  LINK_IN_BIO: 'link_in_bio',
  PLAYLIST_PITCHING: 'playlist_pitching',
  NEED_TO_KNOW_PLANS_BENEFITS: 'need_to_know_plans_benefits',
  HIGH_PROFILE_ARTIST_VERIFICATION: 'high_profile_artist_verification',
  NEED_TO_KNOW_MARKETING_ACTIVITIES: 'need_to_know_marketing_activities',
  INFORMATION_SYNC_PLACEMENT: 'information_sync_placement_opportunities',
  INFORMATION_ON_PRICING: 'information_on_pricing',
  OTHER_QUERIES: 'other_queries',
  PAYMENT_OR_REFUND: 'payment_or_refund',
  CAMPAIGN_OR_TECHNICAL: 'campaign_or_technical',
} as const;

export type SupportTicketIssueType =
  (typeof SUPPORT_TICKET_ISSUE_TYPE)[keyof typeof SUPPORT_TICKET_ISSUE_TYPE];

export const SUPPORT_TICKET_ISSUE_TYPES_BY_CATEGORY: Record<
  SupportTicketCategory,
  readonly SupportTicketIssueType[]
> = {
  [SUPPORT_TICKET_CATEGORY.PAYMENT_AND_BILLING]: [
    SUPPORT_TICKET_ISSUE_TYPE.PLAN_PAYMENT_NOT_REFLECTING_DISTRIBUTION,
    SUPPORT_TICKET_ISSUE_TYPE.PLAN_PAYMENT_NOT_REFLECTING_PUBLISHING,
    SUPPORT_TICKET_ISSUE_TYPE.PAYMENT_MODE_NOT_WORKING,
  ],
  [SUPPORT_TICKET_CATEGORY.ROYALTIES]: [
    SUPPORT_TICKET_ISSUE_TYPE.NOT_ABLE_TO_CASHOUT,
    SUPPORT_TICKET_ISSUE_TYPE.CASHOUT_DONE_ROYALTIES_NOT_RECEIVED,
    SUPPORT_TICKET_ISSUE_TYPE.INCORRECT_ROYALTY_CALCULATION,
  ],
  [SUPPORT_TICKET_CATEGORY.FEATURES_AND_SERVICES]: [
    SUPPORT_TICKET_ISSUE_TYPE.PRE_SAVE_LINKS,
    SUPPORT_TICKET_ISSUE_TYPE.LINK_IN_BIO,
    SUPPORT_TICKET_ISSUE_TYPE.PLAYLIST_PITCHING,
  ],
  [SUPPORT_TICKET_CATEGORY.GENERAL_AND_OTHER]: [
    SUPPORT_TICKET_ISSUE_TYPE.NEED_TO_KNOW_PLANS_BENEFITS,
    SUPPORT_TICKET_ISSUE_TYPE.HIGH_PROFILE_ARTIST_VERIFICATION,
    SUPPORT_TICKET_ISSUE_TYPE.NEED_TO_KNOW_MARKETING_ACTIVITIES,
    SUPPORT_TICKET_ISSUE_TYPE.INFORMATION_SYNC_PLACEMENT,
    SUPPORT_TICKET_ISSUE_TYPE.INFORMATION_ON_PRICING,
    SUPPORT_TICKET_ISSUE_TYPE.OTHER_QUERIES,
  ],
  [SUPPORT_TICKET_CATEGORY.EXPRESS_SUPPORT]: [
    SUPPORT_TICKET_ISSUE_TYPE.PAYMENT_OR_REFUND,
    SUPPORT_TICKET_ISSUE_TYPE.CAMPAIGN_OR_TECHNICAL,
  ],
};

export const SUPPORT_TICKET_CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  payment_and_billing: 'Payment and Billing Issues',
  royalties: 'Royalties',
  features_and_services: 'Features and Services',
  general_and_other_queries: 'General and Other Queries',
  express_support: 'Express Support',
};

export const SUPPORT_TICKET_ISSUE_TYPE_LABELS: Record<SupportTicketIssueType, string> = {
  plan_payment_not_reflecting_distribution: 'Plan Payment Done, But Not Reflecting (Distribution)',
  plan_payment_not_reflecting_publishing: 'Plan Payment Done, But Not Reflecting (Publishing)',
  payment_mode_not_working: 'Payment Mode Not Working',
  not_able_to_cashout: 'Not Able to Cashout',
  cashout_done_royalties_not_received: 'Cashout Done But Royalties Not Received',
  incorrect_royalty_calculation: 'Incorrect Royalty Calculation',
  pre_save_links: 'Pre Save Links',
  link_in_bio: 'Link In Bio',
  playlist_pitching: 'Playlist Pitching',
  need_to_know_plans_benefits: 'Need to Know About Plans, Benefits',
  high_profile_artist_verification: 'High Profile Artist Verification',
  need_to_know_marketing_activities: 'Need to Know Marketing Activities Offered',
  information_sync_placement_opportunities: 'Information on Sync and Placement Opportunities',
  information_on_pricing: 'Information on Pricing',
  other_queries: 'Other Queries',
  payment_or_refund: 'Payment or Refund',
  campaign_or_technical: 'Campaign or Technical',
};

export const SUPPORT_TICKET_CASE_FILTER = {
  ALL: 'all',
  OPEN: 'open',
  RESOLVED: 'resolved',
} as const;

export type SupportTicketCaseFilter =
  (typeof SUPPORT_TICKET_CASE_FILTER)[keyof typeof SUPPORT_TICKET_CASE_FILTER];

export const ALL_SUPPORT_TICKET_CATEGORIES = Object.values(
  SUPPORT_TICKET_CATEGORY,
) as SupportTicketCategory[];

export const ALL_SUPPORT_TICKET_ISSUE_TYPES = Object.values(
  SUPPORT_TICKET_ISSUE_TYPE,
) as SupportTicketIssueType[];

export function isValidSupportTicketIssueTypeForCategory(
  category: SupportTicketCategory,
  issueType: SupportTicketIssueType,
): boolean {
  return SUPPORT_TICKET_ISSUE_TYPES_BY_CATEGORY[category].includes(issueType);
}

export function getDefaultIssueTypeForCategory(
  category: SupportTicketCategory,
): SupportTicketIssueType {
  return SUPPORT_TICKET_ISSUE_TYPES_BY_CATEGORY[category][0];
}

export const SUPPORT_TICKET_AUTO_CLOSE_HOURS = 48;

export function buildSupportTicketSubject(issueType: SupportTicketIssueType): string {
  return `SUPPORT | ${SUPPORT_TICKET_ISSUE_TYPE_LABELS[issueType]}`;
}
