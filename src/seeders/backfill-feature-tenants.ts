import { Types } from 'mongoose';
import { logger } from '@/config/logger';
import { LEGACY_TENANT_SLUG } from '@/constants';
import { TenantModel } from '@/modules/tenant/tenant.model';
import { UserModel } from '@/modules/user/user.model';
import { MusicReleaseModel } from '@/modules/music-release/music-release.model';
import { ChannelModel } from '@/modules/channel/channel.model';
import { ChannelLinkingModel } from '@/modules/channel-linking/channel-linking.model';
import { SupportTicketModel } from '@/modules/support-ticket/support-ticket.model';
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
import { ReleaseLabelModel } from '@/modules/release-catalog/release-label.model';
import { ReleaseArtistModel } from '@/modules/release-catalog/release-artist.model';
import { LabelTransferModel } from '@/modules/label-transfer/label-transfer.model';
import { LabelUpdateModel } from '@/modules/label-update/label-update.model';

type LeanUser = { _id: Types.ObjectId; tenantId?: Types.ObjectId | null };

const ISSUES_MODEL_NAMES = [
  'InvalidReference',
  'OwnershipTransfer',
  'PotentialClaim',
  'DisputedClaim',
  'AppealedClaim',
] as const;

function missingTenantFilter(): Record<string, unknown> {
  return {
    $or: [{ tenantId: null }, { tenantId: { $exists: false } }],
  };
}

async function backfillCollectionByUserField(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: { collection: { name: string }; find: any; updateOne: any },
  userFields: string[],
  userTenantById: Map<string, string>,
  legacyTenantId: Types.ObjectId,
): Promise<number> {
  const docs = await model
    .find(missingTenantFilter())
    .select(['_id', ...userFields].join(' '))
    .lean()
    .exec();

  let updated = 0;
  for (const doc of docs as Array<Record<string, unknown> & { _id: Types.ObjectId }>) {
    let resolved: string | null = null;
    for (const field of userFields) {
      const raw = doc[field];
      if (!raw) continue;
      const userId =
        typeof raw === 'object' && raw !== null && '_id' in (raw as object)
          ? String((raw as { _id: { toString(): string } })._id)
          : String(raw);
      const fromUser = userTenantById.get(userId);
      if (fromUser) {
        resolved = fromUser;
        break;
      }
    }

    const tenantId = resolved ? new Types.ObjectId(resolved) : legacyTenantId;
    await model.updateOne({ _id: doc._id }, { $set: { tenantId } });
    updated += 1;
  }

  if (updated > 0) {
    logger.info(`Backfilled tenantId on ${updated} ${model.collection.name} document(s)`);
  }
  return updated;
}

/**
 * After users/tenants are seeded: stamp tenantId on feature docs that lack it.
 * Prefer creator (or assignee for issues) user.tenantId; else Legacy tenant.
 */
export async function backfillFeatureTenantIds(): Promise<void> {
  const legacy = await TenantModel.findOne({ slug: LEGACY_TENANT_SLUG }).select('_id').lean();
  if (!legacy) {
    logger.warn('Legacy tenant missing — skip feature tenantId backfill');
    return;
  }
  const legacyTenantId = legacy._id as Types.ObjectId;

  // Drop pre-tenant unique indexes on catalog names (ignore if already gone).
  for (const coll of [ReleaseLabelModel.collection, ReleaseArtistModel.collection]) {
    try {
      await coll.dropIndex('normalizedName_1');
      logger.info(`Dropped legacy unique index normalizedName_1 on ${coll.name}`);
    } catch {
      /* index may already be gone */
    }
  }

  const users = (await UserModel.find({})
    .select('_id tenantId')
    .lean()
    .exec()) as LeanUser[];

  const userTenantById = new Map<string, string>();
  for (const user of users) {
    if (user.tenantId) {
      userTenantById.set(user._id.toString(), user.tenantId.toString());
    }
  }

  const creatorCollections = [
    MusicReleaseModel,
    ChannelModel,
    ChannelLinkingModel,
    SupportTicketModel,
    YoutubeClaimReleaseModel,
    FacebookClaimReleaseModel,
    ContentIdModel,
    OacModel,
    ProfileLinkingModel,
    AllowlistModel,
    ManualClaimingModel,
    TakedownModel,
    ReleaseLabelModel,
    ReleaseArtistModel,
    LabelTransferModel,
    LabelUpdateModel,
  ];

  let total = 0;
  for (const model of creatorCollections) {
    total += await backfillCollectionByUserField(
      model,
      model === LabelTransferModel
        ? ['transferredBy', 'fromUser', 'toUser']
        : model === LabelUpdateModel
          ? ['updatedBy', 'owner']
          : ['createdBy'],
      userTenantById,
      legacyTenantId,
    );
  }

  total += await backfillCollectionByUserField(
    ReferenceOverlapModel,
    ['createdBy', 'assignedTo'],
    userTenantById,
    legacyTenantId,
  );

  for (const modelName of ISSUES_MODEL_NAMES) {
    const model = getIssuesEntryModel(modelName);
    total += await backfillCollectionByUserField(
      model,
      ['createdBy', 'assignedTo'],
      userTenantById,
      legacyTenantId,
    );
  }

  logger.info(`Feature tenantId backfill complete (${total} document(s) updated)`);
}
