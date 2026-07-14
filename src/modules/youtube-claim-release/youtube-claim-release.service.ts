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

interface Actor {
  id: string;
  isSuperAdmin: boolean;
}

function assertOwnership(item: IYoutubeClaimRelease, actor: Actor): void {
  if (actor.isSuperAdmin) return;
  const createdBy = item.createdBy as unknown;
  const ownerId =
    createdBy && typeof createdBy === 'object' && '_id' in (createdBy as object)
      ? String((createdBy as { _id: { toString(): string } })._id)
      : String(createdBy);
  if (ownerId !== actor.id) {
    throw ApiError.forbidden('You can only modify your own claim releases');
  }
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
  private scope(actor: Actor) {
    return actor.isSuperAdmin ? {} : { createdBy: actor.id };
  }

  async list(query: ListQueryDto, actor: Actor): Promise<PaginatedResult<IYoutubeClaimRelease>> {
    return youtubeClaimReleaseRepository.paginate(query, this.scope(actor));
  }

  async getById(id: string, actor: Actor): Promise<IYoutubeClaimRelease> {
    const item = await youtubeClaimReleaseRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Claim release not found');
    assertOwnership(item, actor);
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
    assertOwnership(item, actor);

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
    if (!actor.isSuperAdmin) {
      throw ApiError.forbidden('Only Super Admin can change claim release status');
    }

    const item = await youtubeClaimReleaseRepository.findById(id);
    if (!item) throw ApiError.notFound('Claim release not found');

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
    assertOwnership(item, actor);
    await youtubeClaimReleaseRepository.deleteById(id);
  }

  async exportCsv(query: ExportQueryDto, actor: Actor): Promise<string> {
    const items = await youtubeClaimReleaseRepository.findForExport({
      ...this.scope(actor),
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
