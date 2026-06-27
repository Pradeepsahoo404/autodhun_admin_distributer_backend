import { Model } from 'mongoose';
import { YoutubeClaimReleaseModel } from '@/modules/youtube-claim-release/youtube-claim-release.model';
import { FacebookClaimReleaseModel } from '@/modules/facebook-claim-release/facebook-claim-release.model';
import { ContentIdModel } from '@/modules/content-id/content-id.model';
import { OacModel } from '@/modules/oac/oac.model';
import { ProfileLinkingModel } from '@/modules/profile-linking/profile-linking.model';
import { AllowlistModel } from '@/modules/allowlist/allowlist.model';
import { ManualClaimingModel } from '@/modules/manual-claiming/manual-claiming.model';
import { TakedownModel } from '@/modules/takedown/takedown.model';
import { ReferenceOverlapModel } from '@/modules/reference-overlaps/reference-overlaps.model';
import { getIssuesEntryModel } from '@/modules/issues-shared/issues-entry.model';

export interface AutoDeleteTarget {
  module: string;
  label: string;
  group: 'legal' | 'issues';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>;
}

export const AUTO_DELETE_TARGETS: AutoDeleteTarget[] = [
  { module: 'youtube-claim-releases', label: 'Youtube Claim Release', group: 'legal', model: YoutubeClaimReleaseModel },
  { module: 'facebook-claim-releases', label: 'Facebook Claim Release', group: 'legal', model: FacebookClaimReleaseModel },
  { module: 'content-id', label: 'Content ID', group: 'legal', model: ContentIdModel },
  { module: 'oac', label: 'OAC', group: 'legal', model: OacModel },
  { module: 'profile-linking', label: 'Profile Linking', group: 'legal', model: ProfileLinkingModel },
  { module: 'allowlist', label: 'Allowlist', group: 'legal', model: AllowlistModel },
  { module: 'manual-claiming', label: 'Manual Claiming', group: 'legal', model: ManualClaimingModel },
  { module: 'takedown', label: 'Takedown', group: 'legal', model: TakedownModel },
  { module: 'reference-overlaps', label: 'Reference Overlaps', group: 'issues', model: ReferenceOverlapModel },
  { module: 'invalid-references', label: 'Invalid References', group: 'issues', model: getIssuesEntryModel('InvalidReference') },
  { module: 'ownership-transfers', label: 'Ownership Transfers', group: 'issues', model: getIssuesEntryModel('OwnershipTransfer') },
  { module: 'potential-claims', label: 'Potential Claims', group: 'issues', model: getIssuesEntryModel('PotentialClaim') },
  { module: 'disputed-claims', label: 'Disputed Claims', group: 'issues', model: getIssuesEntryModel('DisputedClaim') },
  { module: 'appealed-claims', label: 'Appealed Claims', group: 'issues', model: getIssuesEntryModel('AppealedClaim') },
];
