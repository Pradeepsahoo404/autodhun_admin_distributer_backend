import { profileLinkingRepository } from './profile-linking.repository';
import { ApiError } from '@/utils/ApiError';
import { IProfileLinking, PROFILE_LINKING_STATUS } from './profile-linking.model';
import { PaginatedResult } from '@/types';
import {
  CreateProfileLinkingDto,
  ExportQueryDto,
  ListQueryDto,
  UpdateStatusDto,
  UpdateProfileLinkingDto,
} from './profile-linking.validator';
import { IUser } from '@/modules/user/user.model';
import { rightsManagerNotificationsService } from '@/modules/notification/rights-manager-notifications.service';
import { assertLabelsAccessible } from '@/utils/labelOwnership';

interface Actor {
  id: string;
  isSuperAdmin: boolean;
}

function assertOwnership(item: IProfileLinking, actor: Actor): void {
  if (actor.isSuperAdmin) return;
  const createdBy = item.createdBy as unknown;
  const ownerId =
    createdBy && typeof createdBy === 'object' && '_id' in (createdBy as object)
      ? String((createdBy as { _id: { toString(): string } })._id)
      : String(createdBy);
  if (ownerId !== actor.id) {
    throw ApiError.forbidden('You can only modify your own profile linking entries');
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

class ProfileLinkingService {
  private scope(actor: Actor) {
    return actor.isSuperAdmin ? {} : { createdBy: actor.id };
  }

  async list(query: ListQueryDto, actor: Actor): Promise<PaginatedResult<IProfileLinking>> {
    return profileLinkingRepository.paginate(query, this.scope(actor));
  }

  async getById(id: string, actor: Actor): Promise<IProfileLinking> {
    const item = await profileLinkingRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Profile linking entry not found');
    assertOwnership(item, actor);
    return item;
  }

  async create(dto: CreateProfileLinkingDto, actor: Actor): Promise<IProfileLinking> {
    await assertLabelsAccessible(actor, dto.labelName);

    const created = await profileLinkingRepository.create({
      ...dto,
      status: PROFILE_LINKING_STATUS.IN_PROGRESS,
      createdBy: actor.id as never,
      updatedBy: actor.id as never,
    });
    const populated = await profileLinkingRepository.findByIdPopulated(created._id.toString());
    const result = populated as IProfileLinking;
    await rightsManagerNotificationsService.notifyEntryCreated('profile-linking', result as never, actor);
    return result;
  }

  async update(
    id: string,
    dto: UpdateProfileLinkingDto,
    actor: Actor,
  ): Promise<IProfileLinking> {
    const item = await profileLinkingRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Profile linking entry not found');
    assertOwnership(item, actor);

    await assertLabelsAccessible(actor, dto.labelName);

    const updated = await profileLinkingRepository.updateById(id, {
      ...dto,
      updatedBy: actor.id as never,
    });
    const populated = await profileLinkingRepository.findByIdPopulated(updated!._id.toString());
    return populated as IProfileLinking;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: Actor): Promise<IProfileLinking> {
    if (!actor.isSuperAdmin) {
      throw ApiError.forbidden('Only Super Admin can change profile linking status');
    }

    const item = await profileLinkingRepository.findById(id);
    if (!item) throw ApiError.notFound('Profile linking entry not found');

    await profileLinkingRepository.updateById(id, {
      status: dto.status,
      updatedBy: actor.id as never,
    });

    const populated = await profileLinkingRepository.findByIdPopulated(id);
    const result = populated as IProfileLinking;
    await rightsManagerNotificationsService.notifyStatusUpdated(
      'profile-linking',
      result as never,
      dto.status,
      actor,
    );
    return result;
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const item = await profileLinkingRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Profile linking entry not found');
    assertOwnership(item, actor);
    await profileLinkingRepository.deleteById(id);
  }

  async exportCsv(query: ExportQueryDto, actor: Actor): Promise<string> {
    const items = await profileLinkingRepository.findForExport({
      ...this.scope(actor),
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const headers = [
      'Label Name',
      'ISRC Code',
      'Facebook Page Link',
      'Instagram Handle Name',
      'Status',
      'Admin Name',
      'Admin Email',
      'Created At',
      'Updated At',
    ];

    const rows = items.map((item) => {
      const creator = item.createdBy as unknown as IUser | undefined;
      return [
        escapeCsv(item.labelName),
        escapeCsv(item.isrcCode),
        escapeCsv(item.facebookPageLink),
        escapeCsv(item.instagramHandleName),
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

export const profileLinkingService = new ProfileLinkingService();
