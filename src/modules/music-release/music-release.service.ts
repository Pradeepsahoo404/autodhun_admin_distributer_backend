import { Types } from 'mongoose';
import { musicReleaseRepository } from './music-release.repository';
import { ApiError } from '@/utils/ApiError';
import { IMusicRelease, MusicReleaseModel } from './music-release.model';
import { ReleaseLabelModel } from '@/modules/release-catalog/release-label.model';
import {
  parseBulkReleaseWorkbook,
  type BulkRowError,
} from './music-release-bulk';
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
import {
  previewNextReleaseIsrc,
  resolveTracksIsrc,
  assertOwnIsrcsAvailable,
  isReleaseIsrcTaken,
  allocateReleaseIsrcCodes,
  normalizeReleaseIsrc,
} from '@/utils/releaseIsrc';
import { assertLabelsAccessible, ensureLabelOwnershipBackfill } from '@/utils/labelOwnership';
import {
  buildCreatedByScope,
  assertCreatedByAccess,
  canManagePlatformWorkflow,
  getScopeUserIds,
  type ScopeActor,
} from '@/utils/dataScope';

interface Actor {
  id: string;
  roleId: string;
  roleSlug: string;
  isSuperAdmin: boolean;
  isSubAdmin: boolean;
  name?: string;
}

interface UploadedFiles {
  coverArt?: Express.Multer.File;
  audioFiles: Express.Multer.File[];
}

export interface BulkImportResult {
  totalRows: number;
  created: number;
  failed: number;
  errors: BulkRowError[];
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Rejects a release whose Title+Artist+Label or UPC already exists. */
async function assertReleaseNotDuplicate(
  data: { title: string; artist: string; label: string; upc?: string },
  excludeReleaseId?: string,
): Promise<void> {
  const title = data.title.trim();
  const artist = data.artist.trim();
  const label = data.label.trim();
  const upc = data.upc?.trim() ?? '';

  const orConditions: Record<string, unknown>[] = [
    {
      title: new RegExp(`^${escapeRegex(title)}$`, 'i'),
      artist: new RegExp(`^${escapeRegex(artist)}$`, 'i'),
      label: new RegExp(`^${escapeRegex(label)}$`, 'i'),
    },
  ];
  if (upc) orConditions.push({ upc });

  const filter: Record<string, unknown> = { $or: orConditions };
  if (excludeReleaseId && Types.ObjectId.isValid(excludeReleaseId)) {
    filter._id = { $ne: new Types.ObjectId(excludeReleaseId) };
  }

  const existing = await MusicReleaseModel.findOne(filter, { title: 1, upc: 1 }).lean();
  if (!existing) return;

  if (upc && (existing.upc ?? '').trim() === upc) {
    throw ApiError.conflict(`UPC "${upc}" is already used by an existing release`);
  }
  throw ApiError.conflict('A release with this title, artist and label already exists');
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

async function assertOwnership(item: IMusicRelease, actor: Actor): Promise<void> {
  await assertCreatedByAccess(actor as ScopeActor, item.createdBy);
}

async function assertModuleAccess(
  actor: Actor,
  moduleSlug: string,
  action: 'view' | 'create' | 'update' | 'delete',
): Promise<void> {
  if (actor.isSuperAdmin) return;
  const allowed = await permissionService.can(
    actor.roleId,
    actor.roleSlug,
    moduleSlug,
    action,
    actor.id,
  );
  if (!allowed) {
    throw ApiError.forbidden(`No ${action} access to module: ${moduleSlug}`);
  }
}

async function scopeForContext(
  context: MusicReleaseListContext,
  actor: Actor,
): Promise<Record<string, unknown>> {
  if (context === MUSIC_RELEASE_LIST_CONTEXT.CONTENT_DELIVERY) {
    if (!canManagePlatformWorkflow(actor as ScopeActor)) {
      throw ApiError.forbidden('Content Delivery is for Super Admin or Sub Admin only');
    }
    const ownerScope = actor.isSuperAdmin
      ? {}
      : await buildCreatedByScope(actor as ScopeActor);
    return { ...ownerScope, status: { $in: CONTENT_DELIVERY_STATUSES } };
  }

  if (context === MUSIC_RELEASE_LIST_CONTEXT.ASSETS_OVERVIEW) {
    if (!canManagePlatformWorkflow(actor as ScopeActor)) {
      throw ApiError.forbidden('Assets overview is for Super Admin or Sub Admin only');
    }
    const ownerScope = actor.isSuperAdmin
      ? {}
      : await buildCreatedByScope(actor as ScopeActor);
    return { ...ownerScope, status: { $in: ASSETS_OVERVIEW_STATUSES } };
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
    const scope = await scopeForContext(query.context, actor);
    return musicReleaseRepository.paginate(query, scope);
  }

  async getById(id: string, actor: Actor): Promise<IMusicRelease> {
    await assertModuleAccess(actor, 'release', 'view');
    const item = await musicReleaseRepository.findByIdPopulated(id);
    if (!item) throw ApiError.notFound('Release not found');
    await assertOwnership(item, actor);
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

    await assertReleaseNotDuplicate(dto);

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

  async bulkImport(fileBuffer: Buffer, actor: Actor): Promise<BulkImportResult> {
    await assertModuleAccess(actor, 'release', 'create');

    const { releases, errors, totalRows } = parseBulkReleaseWorkbook(fileBuffer);

    if (totalRows === 0) {
      throw ApiError.badRequest('The file has no data rows. Fill in the template and try again.');
    }

    const allErrors: BulkRowError[] = [...errors];

    if (!actor.isSuperAdmin && releases.length > 0) {
      await ensureLabelOwnershipBackfill();
      const uniqueNormalized = [...new Set(releases.map((r) => r.label.trim().toLowerCase()))];
      const labels = await ReleaseLabelModel.find({ normalizedName: { $in: uniqueNormalized } })
        .select('name normalizedName ownedBy status')
        .lean();
      const byNorm = new Map(labels.map((l) => [l.normalizedName, l]));
      const scopeIds = await getScopeUserIds(actor as ScopeActor);

      for (const release of releases) {
        const label = byNorm.get(release.label.trim().toLowerCase());
        if (!label) {
          allErrors.push({
            row: release.rowNumber,
            field: 'Label',
            message: `Label "${release.label}" is not available. Create it from your release form first.`,
          });
        } else if (!scopeIds?.includes(String(label.ownedBy))) {
          allErrors.push({
            row: release.rowNumber,
            field: 'Label',
            message: `You do not have access to label "${release.label}"`,
          });
        } else if (label.status && label.status !== 'active') {
          allErrors.push({
            row: release.rowNumber,
            field: 'Label',
            message: `Label "${release.label}" is blocked and cannot be used`,
          });
        }
      }
    }

    const ownSeen = new Map<string, number>();
    for (const release of releases) {
      for (const track of release.tracks) {
        if (track.isrcOption !== 'own') continue;
        const normalized = normalizeReleaseIsrc(track.isrc);
        if (!normalized) continue;

        const seenAt = ownSeen.get(normalized);
        if (seenAt) {
          allErrors.push({
            row: release.rowNumber,
            field: 'ISRC',
            message: `ISRC "${normalized}" is duplicated in the file (also on row ${seenAt})`,
          });
          continue;
        }
        ownSeen.set(normalized, release.rowNumber);

        if (await isReleaseIsrcTaken(normalized)) {
          allErrors.push({
            row: release.rowNumber,
            field: 'ISRC',
            message: `ISRC "${normalized}" is already taken`,
          });
        }
      }
    }

    const dupKey = (title: string, artist: string, label: string) =>
      `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}|${label.trim().toLowerCase()}`;

    const keySeenAt = new Map<string, number>();
    const upcSeenAt = new Map<string, number>();
    for (const release of releases) {
      const key = dupKey(release.title, release.artist, release.label);
      const seenAt = keySeenAt.get(key);
      if (seenAt) {
        allErrors.push({
          row: release.rowNumber,
          field: 'Title',
          message: `Duplicate release in the file — same title, artist and label as row ${seenAt}`,
        });
      } else {
        keySeenAt.set(key, release.rowNumber);
      }

      const upc = release.upc.trim();
      if (upc) {
        const upcRow = upcSeenAt.get(upc);
        if (upcRow) {
          allErrors.push({
            row: release.rowNumber,
            field: 'UPC',
            message: `Duplicate UPC "${upc}" in the file (also on row ${upcRow})`,
          });
        } else {
          upcSeenAt.set(upc, release.rowNumber);
        }
      }
    }

    if (releases.length > 0) {
      const titles = [...new Set(releases.map((r) => r.title.trim()))];
      const upcs = [...new Set(releases.map((r) => r.upc.trim()).filter(Boolean))];

      const existing = await MusicReleaseModel.find(
        {
          $or: [
            { title: { $in: titles.map((t) => new RegExp(`^${escapeRegex(t)}$`, 'i')) } },
            ...(upcs.length ? [{ upc: { $in: upcs } }] : []),
          ],
        },
        { title: 1, artist: 1, label: 1, upc: 1 },
      ).lean();

      const existingKeys = new Set(
        existing.map((e) => dupKey(e.title ?? '', e.artist ?? '', e.label ?? '')),
      );
      const existingUpcs = new Set(existing.map((e) => (e.upc ?? '').trim()).filter(Boolean));

      for (const release of releases) {
        if (existingKeys.has(dupKey(release.title, release.artist, release.label))) {
          allErrors.push({
            row: release.rowNumber,
            field: 'Title',
            message: `A release with this title, artist and label already exists`,
          });
        }
        const upc = release.upc.trim();
        if (upc && existingUpcs.has(upc)) {
          allErrors.push({
            row: release.rowNumber,
            field: 'UPC',
            message: `UPC "${upc}" is already used by an existing release`,
          });
        }
      }
    }

    if (allErrors.length > 0) {
      allErrors.sort((a, b) => a.row - b.row);
      return { totalRows, created: 0, failed: totalRows, errors: allErrors };
    }

    const generateCount = releases.reduce(
      (sum, release) => sum + release.tracks.filter((t) => t.isrcOption === 'generate').length,
      0,
    );
    const generatedCodes = generateCount > 0 ? await allocateReleaseIsrcCodes(generateCount) : [];
    let cursor = 0;

    const documents = releases.map((release) => {
      const tracks = release.tracks.map((track) => {
        if (track.isrcOption === 'generate') {
          const isrc = generatedCodes[cursor] ?? '';
          cursor += 1;
          return { ...track, isrc, isrcOption: 'generate' as const };
        }
        return { ...track, isrc: normalizeReleaseIsrc(track.isrc), isrcOption: 'own' as const };
      });

      return {
        title: release.title,
        version: release.version,
        artist: release.artist,
        releaseType: release.releaseType,
        releasingDate: release.releasingDate,
        label: release.label,
        instrumental: release.instrumental,
        explicit: release.explicit,
        aiGenerated: release.aiGenerated,
        upc: release.upc,
        pLine: release.pLine,
        cLine: release.cLine,
        coverArtUrl: '',
        audioFiles: [],
        tracks,
        crbtEntries: release.crbtEntries,
        scheduledReleaseDate: release.scheduledReleaseDate,
        scheduleNotes: release.scheduleNotes,
        releasePlatform: release.releasePlatform,
        status: MUSIC_RELEASE_STATUS.IN_REVIEW,
        createdBy: actor.id,
        updatedBy: actor.id,
      };
    });

    const inserted = await MusicReleaseModel.insertMany(documents, { ordered: false });

    await Promise.allSettled(
      inserted.map(async (doc) => {
        const populated = await musicReleaseRepository.findByIdPopulated(doc._id.toString());
        if (populated) {
          await releaseNotificationsService.notifyReleaseCreated(populated as IMusicRelease, actor);
        }
      }),
    );

    return { totalRows, created: inserted.length, failed: 0, errors: [] };
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

    await assertOwnership(item, actor);

    await assertLabelsAccessible(actor, dto.label);

    await assertReleaseNotDuplicate(dto, id);

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
    if (!canManagePlatformWorkflow(actor as ScopeActor)) {
      throw ApiError.forbidden('Only Super Admin or Sub Admin can change release status');
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
    if (!canManagePlatformWorkflow(actor as ScopeActor)) {
      throw ApiError.forbidden('Only Super Admin or Sub Admin can change release status');
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

    await assertOwnership(item, actor);

    if (item.status !== MUSIC_RELEASE_STATUS.CORRECTION) {
      throw ApiError.forbidden('Only releases in correction can be deleted');
    }

    await musicReleaseRepository.deleteById(id);
  }

  async exportCsv(query: ExportMusicReleasesQueryDto, actor: Actor): Promise<string> {
    const moduleSlug = CONTEXT_MODULE_MAP[query.context];
    await assertModuleAccess(actor, moduleSlug, 'view');
    const scope = await scopeForContext(query.context, actor);

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
