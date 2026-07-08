import { Types } from 'mongoose';
import { musicReleaseRepository } from './music-release.repository';
import { ApiError } from '@/utils/ApiError';
import { IMusicRelease } from './music-release.model';
import { PaginatedResult } from '@/types';
import {
  ASSETS_OVERVIEW_STATUSES,
  CONTENT_DELIVERY_STATUSES,
  CONTEXT_MODULE_MAP,
  MUSIC_RELEASE_LIST_CONTEXT,
  MUSIC_RELEASE_STATUS,
  type MusicReleaseListContext,
  type MusicReleaseStatus,
} from './music-release.constants';
import {
  CreateMusicReleaseBodyDto,
  ListMusicReleasesQueryDto,
  ExportMusicReleasesQueryDto,
  BulkUpdateMusicReleaseStatusDto,
  UpdateMusicReleaseStatusDto,
} from './music-release.validator';
import { permissionService } from '@/modules/permission/permission.service';
import { uploadReleaseAudio, uploadReleaseCover } from '@/utils/releaseUpload';
import { env } from '@/config/env';
import { releaseNotificationsService } from '@/modules/notification/release-notifications.service';
import { previewNextReleaseIsrc, resolveTracksIsrc, assertOwnIsrcsAvailable, isReleaseIsrcTaken } from '@/utils/releaseIsrc';
import { assertLabelsAccessible } from '@/utils/labelOwnership';

interface Actor {
  id: string;
  roleId: string;
  roleSlug: string;
  isSuperAdmin: boolean;
  name?: string;
}

interface UploadedFiles {
  coverArt?: Express.Multer.File;
  audioFiles: Express.Multer.File[];
}

interface PopulatedUser {
  name?: string;
  email?: string;
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDateTime(date: Date): string {
  return date.toISOString();
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function primaryIsrc(item: IMusicRelease): string {
  const track = item.tracks[0];
  if (!track) return '';
  if (track.isrc?.trim()) return track.isrc.trim().toUpperCase();
  return '';
}

function resolveOwnerId(createdBy: unknown): string {
  if (!createdBy) return '';
  if (typeof createdBy === 'object' && createdBy !== null && '_id' in createdBy) {
    return String((createdBy as { _id: { toString(): string } })._id);
  }
  return String(createdBy);
}

function assertOwnership(item: IMusicRelease, actor: Actor): void {
  if (actor.isSuperAdmin) return;
  const ownerId = resolveOwnerId(item.createdBy);
  if (ownerId !== actor.id) {
    throw ApiError.forbidden('You can only access your own releases');
  }
}

async function assertModuleAccess(
  actor: Actor,
  moduleSlug: string,
  action: 'view' | 'create' | 'update' | 'delete',
): Promise<void> {
  if (actor.isSuperAdmin) return;
  const allowed = await permissionService.can(actor.roleId, actor.roleSlug, moduleSlug, action);
  if (!allowed) {
    throw ApiError.forbidden(`No ${action} access to module: ${moduleSlug}`);
  }
}

function scopeForContext(context: MusicReleaseListContext, actor: Actor): Record<string, unknown> {
  if (context === MUSIC_RELEASE_LIST_CONTEXT.CONTENT_DELIVERY) {
    if (!actor.isSuperAdmin) {
      throw ApiError.forbidden('Content Delivery is for Super Admin only');
    }
    return { status: { $in: CONTENT_DELIVERY_STATUSES } };
  }

  if (context === MUSIC_RELEASE_LIST_CONTEXT.ASSETS_OVERVIEW) {
    if (!actor.isSuperAdmin) {
      throw ApiError.forbidden('Assets overview is for Super Admin only');
    }
    return { status: { $in: ASSETS_OVERVIEW_STATUSES } };
  }

  if (context === MUSIC_RELEASE_LIST_CONTEXT.CORRECTION) {
    return { createdBy: actor.id, status: MUSIC_RELEASE_STATUS.CORRECTION };
  }

  return {
    createdBy: actor.id,
    status: { $ne: MUSIC_RELEASE_STATUS.CORRECTION },
  };
}

class MusicReleaseService {
  async list(query: ListMusicReleasesQueryDto, actor: Actor): Promise<PaginatedResult<IMusicRelease>> {
    const moduleSlug = CONTEXT_MODULE_MAP[query.context];
    await assertModuleAccess(actor, moduleSlug, 'view');
    const scope = scopeForContext(query.context, actor);
    return musicReleaseRepository.paginate(query, scope);
  }

  async getById(id: string, actor: Actor): Promise<IMusicRelease> {
    await assertModuleAccess(actor, 'release', 'view');
    const item = await musicReleaseRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Release not found');
    assertOwnership(item, actor);
    return item;
  }

  async previewNextIsrc(count = 1, actor: Actor): Promise<string[]> {
    await assertModuleAccess(actor, 'release', 'view');
    const safeCount = Math.min(Math.max(count, 1), 20);
    return previewNextReleaseIsrc(safeCount);
  }

  async checkIsrcAvailability(
    code: string,
    excludeReleaseId: string | undefined,
    actor: Actor,
  ): Promise<{ available: boolean }> {
    await assertModuleAccess(actor, 'release', 'view');
    const taken = await isReleaseIsrcTaken(code, excludeReleaseId);
    return { available: !taken };
  }

  async create(dto: CreateMusicReleaseBodyDto, files: UploadedFiles, actor: Actor): Promise<IMusicRelease> {
    await assertModuleAccess(actor, 'release', 'create');

    if (!files.coverArt) {
      throw ApiError.badRequest('Cover art is required');
    }
    if (!files.audioFiles.length) {
      throw ApiError.badRequest('At least one audio file is required');
    }

    await assertLabelsAccessible(actor, dto.label);

    await assertOwnIsrcsAvailable(dto.tracks);

    const releaseKey = new Types.ObjectId().toString();
    const coverArtUrl = await uploadReleaseCover(files.coverArt.buffer, releaseKey);

    const audioFiles = await Promise.all(
      files.audioFiles.map(async (file, index) => ({
        fileName: file.originalname,
        url: await uploadReleaseAudio(file.buffer, releaseKey, index, file.originalname),
        mimeType: file.mimetype,
        sizeBytes: file.size,
      })),
    );

    const tracks = await resolveTracksIsrc(dto.tracks);

    const created = await musicReleaseRepository.create({
      ...dto,
      tracks,
      coverArtUrl,
      audioFiles,
      status: MUSIC_RELEASE_STATUS.IN_REVIEW,
      createdBy: actor.id as never,
      updatedBy: actor.id as never,
    });

    const populated = await musicReleaseRepository.findByIdPopulated(created._id.toString());
    const release = populated as IMusicRelease;
    await releaseNotificationsService.notifyReleaseCreated(release, actor);
    return release;
  }

  async update(
    id: string,
    dto: CreateMusicReleaseBodyDto,
    files: UploadedFiles,
    actor: Actor,
  ): Promise<IMusicRelease> {
    await assertModuleAccess(actor, 'release', 'update');

    const item = await musicReleaseRepository.findById(id);
    if (!item) throw ApiError.notFound('Release not found');

    assertOwnership(item, actor);

    await assertLabelsAccessible(actor, dto.label);

    await assertOwnIsrcsAvailable(dto.tracks, id);

    const editableStatuses = [MUSIC_RELEASE_STATUS.IN_REVIEW, MUSIC_RELEASE_STATUS.CORRECTION];
    if (!editableStatuses.includes(item.status as typeof editableStatuses[number])) {
      throw ApiError.forbidden('Release can only be edited while status is In Review or Correction');
    }

    const nextStatus =
      item.status === MUSIC_RELEASE_STATUS.CORRECTION
        ? MUSIC_RELEASE_STATUS.IN_REVIEW
        : item.status;

    let coverArtUrl = item.coverArtUrl;
    if (files.coverArt) {
      const releaseKey = id;
      coverArtUrl = await uploadReleaseCover(files.coverArt.buffer, releaseKey);
    }

    let audioFiles = item.audioFiles;
    if (files.audioFiles.length > 0) {
      audioFiles = await Promise.all(
        files.audioFiles.map(async (file, index) => ({
          fileName: file.originalname,
          url: await uploadReleaseAudio(file.buffer, id, index, file.originalname),
          mimeType: file.mimetype,
          sizeBytes: file.size,
        })),
      );
    } else if (dto.tracks.length !== item.audioFiles.length) {
      throw ApiError.badRequest('Upload audio files when changing track count');
    }

    const previousStatus = item.status as MusicReleaseStatus;

    const tracks = await resolveTracksIsrc(dto.tracks, item.tracks);

    await musicReleaseRepository.updateById(id, {
      ...dto,
      tracks,
      coverArtUrl,
      audioFiles,
      status: nextStatus,
      updatedBy: actor.id as never,
    });

    const populated = await musicReleaseRepository.findByIdPopulated(id);
    const release = populated as IMusicRelease;
    await releaseNotificationsService.notifyReleaseUpdated(release, actor, previousStatus);
    return release;
  }

  async updateStatus(id: string, dto: UpdateMusicReleaseStatusDto, actor: Actor): Promise<IMusicRelease> {
    if (!actor.isSuperAdmin) {
      throw ApiError.forbidden('Only Super Admin can change release status');
    }

    const item = await musicReleaseRepository.findById(id);
    if (!item) throw ApiError.notFound('Release not found');

    await musicReleaseRepository.updateById(id, {
      status: dto.status,
      correctionReasons:
        dto.status === MUSIC_RELEASE_STATUS.CORRECTION ? dto.correctionReasons ?? [] : [],
      updatedBy: actor.id as never,
    });

    const populated = await musicReleaseRepository.findByIdPopulated(id);
    const release = populated as IMusicRelease;
    await releaseNotificationsService.notifyReleaseStatusUpdated(
      release,
      dto.status as MusicReleaseStatus,
      actor,
    );
    return release;
  }

  async bulkUpdateStatus(
    dto: BulkUpdateMusicReleaseStatusDto,
    actor: Actor,
  ): Promise<{ updated: number }> {
    if (!actor.isSuperAdmin) {
      throw ApiError.forbidden('Only Super Admin can change release status');
    }

    const releases = await musicReleaseRepository.findByIdsPopulated(dto.ids);
    const updated = await musicReleaseRepository.updateStatusByIds(
      dto.ids,
      dto.status,
      actor.id,
      dto.status === MUSIC_RELEASE_STATUS.CORRECTION ? dto.correctionReasons ?? [] : [],
    );

    await Promise.all(
      releases.map((release) =>
        releaseNotificationsService.notifyReleaseStatusUpdated(
          release,
          dto.status as MusicReleaseStatus,
          actor,
          dto.status === MUSIC_RELEASE_STATUS.CORRECTION
            ? { correctionReasons: dto.correctionReasons ?? [] }
            : undefined,
        ),
      ),
    );

    return { updated };
  }

  async delete(id: string, actor: Actor): Promise<void> {
    await assertModuleAccess(actor, 'release-correction', 'delete');

    const item = await musicReleaseRepository.findById(id);
    if (!item) throw ApiError.notFound('Release not found');

    assertOwnership(item, actor);

    if (item.status !== MUSIC_RELEASE_STATUS.CORRECTION) {
      throw ApiError.forbidden('Only releases in correction can be deleted');
    }

    await musicReleaseRepository.deleteById(id);
  }

  async exportCsv(query: ExportMusicReleasesQueryDto, actor: Actor): Promise<string> {
    const moduleSlug = CONTEXT_MODULE_MAP[query.context];
    await assertModuleAccess(actor, moduleSlug, 'view');
    const scope = scopeForContext(query.context, actor);

    const items = await musicReleaseRepository.findForExport({
      ...scope,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const headers = [
      'Title',
      'Version',
      'Artist',
      'Label',
      'Release Type',
      'Releasing Date',
      'Scheduled Release Date',
      'Status',
      'UPC',
      'ISRC',
      'Release Platform',
      'Submitted By',
      'Submitted Email',
      'Created At',
      'Updated At',
    ];

    const rows = items.map((item) => {
      const creator = item.createdBy as unknown as PopulatedUser | undefined;
      return [
        escapeCsv(item.title),
        escapeCsv(item.version),
        escapeCsv(item.artist),
        escapeCsv(item.label),
        escapeCsv(item.releaseType),
        escapeCsv(item.releasingDate),
        escapeCsv(item.scheduledReleaseDate),
        escapeCsv(formatStatusLabel(item.status)),
        escapeCsv(item.upc),
        escapeCsv(primaryIsrc(item)),
        escapeCsv(item.releasePlatform),
        escapeCsv(creator?.name ?? ''),
        escapeCsv(creator?.email ?? ''),
        escapeCsv(formatDateTime(item.createdAt)),
        escapeCsv(formatDateTime(item.updatedAt)),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  getLocalFileUrl(filename: string): string {
    return `${env.API_PREFIX}/music-releases/files/${encodeURIComponent(filename)}`;
  }
}

export const musicReleaseService = new MusicReleaseService();
