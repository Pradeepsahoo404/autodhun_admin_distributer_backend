import { facebookClaimReleaseRepository } from './facebook-claim-release.repository';
import { ApiError } from '@/utils/ApiError';
import {
  assertFeatureAccess,
  createdByFeatureScope,
  requireWriteTenantId,
  type TenantActor,
} from '@/utils/tenantScope';
import { CLAIM_RELEASE_STATUS, IFacebookClaimRelease } from './facebook-claim-release.model';
import { PaginatedResult } from '@/types';
import {
  CreateFacebookClaimReleaseDto,
  ExportQueryDto,
  LABEL_NAMES_MUST_MATCH_MESSAGE,
  ListQueryDto,
  UpdateStatusDto,
  UpdateFacebookClaimReleaseDto,
} from './facebook-claim-release.validator';
import { IUser } from '@/modules/user/user.model';
import { rightsManagerNotificationsService } from '@/modules/notification/rights-manager-notifications.service';
import { assertLabelsAccessible } from '@/utils/labelOwnership';

type Actor = TenantActor;

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function assertLabelsMatch(sender: string, receiver: string): void {
  if (sender.trim().toLowerCase() !== receiver.trim().toLowerCase()) {
    throw ApiError.badRequest(LABEL_NAMES_MUST_MATCH_MESSAGE);
  }
}

class FacebookClaimReleaseService {
  private scope(actor: Actor) {
    return createdByFeatureScope(actor);
  }

  async list(query: ListQueryDto, actor: Actor): Promise<PaginatedResult<IFacebookClaimRelease>> {
    return facebookClaimReleaseRepository.paginate(query, this.scope(actor));
  }

  async getById(id: string, actor: Actor): Promise<IFacebookClaimRelease> {
    const item = await facebookClaimReleaseRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Claim release not found');
    assertFeatureAccess(actor, item, 'createdBy');
    return item;
  }

  async create(dto: CreateFacebookClaimReleaseDto, actor: Actor): Promise<IFacebookClaimRelease> {
    assertLabelsMatch(dto.senderLabelName, dto.receiverLabelName);
    await assertLabelsAccessible(actor, dto.senderLabelName, dto.receiverLabelName);

    const created = await facebookClaimReleaseRepository.create({
      tenantId: requireWriteTenantId(actor) as never,
      ...dto,
      status: CLAIM_RELEASE_STATUS.IN_PROGRESS,
      createdBy: actor.id as never,
      updatedBy: actor.id as never,
    });
    const populated = await facebookClaimReleaseRepository.findByIdPopulated(created._id.toString());
    const result = populated as IFacebookClaimRelease;
    await rightsManagerNotificationsService.notifyEntryCreated('facebook-claim-release', result as never, actor);
    return result;
  }

  async update(
    id: string,
    dto: UpdateFacebookClaimReleaseDto,
    actor: Actor,
  ): Promise<IFacebookClaimRelease> {
    const item = await facebookClaimReleaseRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Claim release not found');
    assertFeatureAccess(actor, item, 'createdBy');

    const sender = dto.senderLabelName ?? item.senderLabelName;
    const receiver = dto.receiverLabelName ?? item.receiverLabelName;
    assertLabelsMatch(sender, receiver);
    await assertLabelsAccessible(actor, sender, receiver);

    const updated = await facebookClaimReleaseRepository.updateById(id, {
      ...dto,
      updatedBy: actor.id as never,
    });
    const populated = await facebookClaimReleaseRepository.findByIdPopulated(updated!._id.toString());
    return populated as IFacebookClaimRelease;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: Actor): Promise<IFacebookClaimRelease> {
    if (!actor.isSuperAdmin) {
      throw ApiError.forbidden('Only Super Admin can change claim release status');
    }

    const item = await facebookClaimReleaseRepository.findById(id);
    if (!item) throw ApiError.notFound('Claim release not found');
    assertFeatureAccess(actor, item, 'createdBy');

    await facebookClaimReleaseRepository.updateById(id, {
      status: dto.status,
      updatedBy: actor.id as never,
    });

    const populated = await facebookClaimReleaseRepository.findByIdPopulated(id);
    const result = populated as IFacebookClaimRelease;
    await rightsManagerNotificationsService.notifyStatusUpdated(
      'facebook-claim-release',
      result as never,
      dto.status,
      actor,
    );
    return result;
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const item = await facebookClaimReleaseRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Claim release not found');
    assertFeatureAccess(actor, item, 'createdBy');
    await facebookClaimReleaseRepository.deleteById(id);
  }

  async exportCsv(query: ExportQueryDto, actor: Actor): Promise<string> {
    const items = await facebookClaimReleaseRepository.findForExport({
      ...this.scope(actor),
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const headers = [
      'Sender Label',
      'Receiver Label',
      'Facebook Page Link',
      'ISRC Code',
      'Status',
      'Admin Name',
      'Admin Email',
      'Created At',
      'Updated At',
    ];

    const rows = items.map((item) => {
      const creator = item.createdBy as unknown as IUser | undefined;
      return [
        escapeCsv(item.senderLabelName),
        escapeCsv(item.receiverLabelName),
        escapeCsv(item.facebookPageLink),
        escapeCsv(item.isrcCode),
        escapeCsv(item.status),
        escapeCsv(creator?.name ?? ''),
        escapeCsv(creator?.email ?? ''),
        escapeCsv(formatDateTime(item.createdAt)),
        escapeCsv(formatDateTime(item.updatedAt)),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}

export const facebookClaimReleaseService = new FacebookClaimReleaseService();
