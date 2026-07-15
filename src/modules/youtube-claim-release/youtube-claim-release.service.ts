import { youtubeClaimReleaseRepository } from './youtube-claim-release.repository';
import { ApiError } from '@/utils/ApiError';
import { CLAIM_RELEASE_STATUS, IYoutubeClaimRelease } from './youtube-claim-release.model';
import { PaginatedResult } from '@/types';
import {
  CreateYoutubeClaimReleaseDto,
  ExportQueryDto,
  LABEL_NAMES_MUST_MATCH_MESSAGE,
  ListQueryDto,
  UpdateStatusDto,
  UpdateYoutubeClaimReleaseDto,
} from './youtube-claim-release.validator';
import { IUser } from '@/modules/user/user.model';
import { rightsManagerNotificationsService } from '@/modules/notification/rights-manager-notifications.service';
import { assertLabelsAccessible } from '@/utils/labelOwnership';
import {
  buildCreatedByScope,
  assertCreatedByAccess,
  canManagePlatformWorkflow,
  type ScopeActor,
} from '@/utils/dataScope';

interface Actor {
  id: string;
  isSuperAdmin: boolean;
  isSubAdmin: boolean;
  roleSlug: string;
}

async function assertOwnership(item: IYoutubeClaimRelease, actor: Actor): Promise<void> {
  await assertCreatedByAccess(actor as ScopeActor, item.createdBy);
}

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

class YoutubeClaimReleaseService {
  private async scope(actor: Actor) {
    return buildCreatedByScope(actor as ScopeActor);
  }

  async list(query: ListQueryDto, actor: Actor): Promise<PaginatedResult<IYoutubeClaimRelease>> {
    return youtubeClaimReleaseRepository.paginate(query, await this.scope(actor));
  }

  async getById(id: string, actor: Actor): Promise<IYoutubeClaimRelease> {
    const item = await youtubeClaimReleaseRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Claim release not found');
    await assertOwnership(item, actor);
    return item;
  }

  async create(dto: CreateYoutubeClaimReleaseDto, actor: Actor): Promise<IYoutubeClaimRelease> {
    assertLabelsMatch(dto.senderLabelName, dto.receiverLabelName);
    await assertLabelsAccessible(actor, dto.senderLabelName, dto.receiverLabelName);

    const created = await youtubeClaimReleaseRepository.create({
      ...dto,
      status: CLAIM_RELEASE_STATUS.IN_PROGRESS,
      createdBy: actor.id as never,
      updatedBy: actor.id as never,
    });
    const populated = await youtubeClaimReleaseRepository.findByIdPopulated(created._id.toString());
    const result = populated as IYoutubeClaimRelease;
    await rightsManagerNotificationsService.notifyEntryCreated('youtube-claim-release', result as never, actor);
    return result;
  }

  async update(
    id: string,
    dto: UpdateYoutubeClaimReleaseDto,
    actor: Actor,
  ): Promise<IYoutubeClaimRelease> {
    const item = await youtubeClaimReleaseRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Claim release not found');
    await assertOwnership(item, actor);

    const sender = dto.senderLabelName ?? item.senderLabelName;
    const receiver = dto.receiverLabelName ?? item.receiverLabelName;
    assertLabelsMatch(sender, receiver);
    await assertLabelsAccessible(actor, sender, receiver);

    const updated = await youtubeClaimReleaseRepository.updateById(id, {
      ...dto,
      updatedBy: actor.id as never,
    });
    const populated = await youtubeClaimReleaseRepository.findByIdPopulated(updated!._id.toString());
    return populated as IYoutubeClaimRelease;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: Actor): Promise<IYoutubeClaimRelease> {
    if (!canManagePlatformWorkflow(actor as ScopeActor)) {
      throw ApiError.forbidden('Only Super Admin or Sub Admin can change claim release status');
    }

    const item = await youtubeClaimReleaseRepository.findById(id);
    if (!item) throw ApiError.notFound('Claim release not found');

    await assertOwnership(item, actor);

    await youtubeClaimReleaseRepository.updateById(id, {
      status: dto.status,
      updatedBy: actor.id as never,
    });

    const populated = await youtubeClaimReleaseRepository.findByIdPopulated(id);
    const result = populated as IYoutubeClaimRelease;
    await rightsManagerNotificationsService.notifyStatusUpdated(
      'youtube-claim-release',
      result as never,
      dto.status,
      actor,
    );
    return result;
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const item = await youtubeClaimReleaseRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Claim release not found');
    await assertOwnership(item, actor);
    await youtubeClaimReleaseRepository.deleteById(id);
  }

  async exportCsv(query: ExportQueryDto, actor: Actor): Promise<string> {
    const items = await youtubeClaimReleaseRepository.findForExport({
      ...(await this.scope(actor)),
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const headers = [
      'Sender Label',
      'Receiver Label',
      'YouTube Link',
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
        escapeCsv(item.youtubeLink),
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

export const youtubeClaimReleaseService = new YoutubeClaimReleaseService();
