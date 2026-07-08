import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import { musicReleaseService } from './music-release.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ApiError } from '@/utils/ApiError';
import {
  CreateMusicReleaseBodyDto,
  exportQuerySchema,
  listQuerySchema,
  nextIsrcQuerySchema,
  checkIsrcQuerySchema,
} from './music-release.validator';
import { resolveLocalReleaseFile } from '@/utils/releaseUpload';
import { createMusicReleaseBodySchema, updateMusicReleaseBodySchema } from './music-release.validator';

function releaseActor(req: Request) {
  return {
    id: req.user!.id,
    roleId: req.user!.roleId,
    roleSlug: req.user!.role,
    isSuperAdmin: req.user!.isSuperAdmin,
    name: req.user!.name,
  };
}

function collectAudioFiles(req: Request): Express.Multer.File[] {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  if (!files) return [];
  return files.audioFiles ?? [];
}

export function parseMusicReleaseBody(req: Request, _res: Response, next: NextFunction): void {
  parseReleaseBodyWithSchema(req, next, createMusicReleaseBodySchema);
}

export function parseMusicReleaseUpdateBody(req: Request, _res: Response, next: NextFunction): void {
  parseReleaseBodyWithSchema(req, next, updateMusicReleaseBodySchema);
}

function parseReleaseBodyWithSchema(
  req: Request,
  next: NextFunction,
  schema: typeof createMusicReleaseBodySchema,
): void {
  try {
    const raw = req.body?.data;
    if (typeof raw !== 'string') {
      throw ApiError.badRequest('Missing release data');
    }
    const parsed = JSON.parse(raw);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw ApiError.badRequest('Validation failed', result.error.flatten());
    }
    req.body = result.data;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
      return;
    }
    next(ApiError.badRequest('Invalid release data JSON'));
  }
}

class MusicReleaseController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const query = listQuerySchema.parse(req.query);
    const result = await musicReleaseService.list(query, releaseActor(req));
    sendSuccess(res, result.items, 'Releases fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await musicReleaseService.getById(req.params.id, releaseActor(req));
    sendSuccess(res, item, 'Release fetched');
  });

  previewNextIsrc = asyncHandler(async (req: Request, res: Response) => {
    const { count } = nextIsrcQuerySchema.parse(req.query);
    const codes = await musicReleaseService.previewNextIsrc(count, releaseActor(req));
    sendSuccess(res, codes, 'Next ISRC preview');
  });

  checkIsrcAvailability = asyncHandler(async (req: Request, res: Response) => {
    const { code, excludeReleaseId } = checkIsrcQuerySchema.parse(req.query);
    const result = await musicReleaseService.checkIsrcAvailability(
      code,
      excludeReleaseId,
      releaseActor(req),
    );
    sendSuccess(res, result, 'ISRC availability checked');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const dto = req.body as CreateMusicReleaseBodyDto;
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const coverArt = files?.coverArt?.[0];

    const item = await musicReleaseService.create(
      dto,
      { coverArt, audioFiles: collectAudioFiles(req) },
      releaseActor(req),
    );
    sendSuccess(res, item, 'Release submitted — status set to In Review', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const dto = req.body as CreateMusicReleaseBodyDto;
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const coverArt = files?.coverArt?.[0];

    const item = await musicReleaseService.update(
      req.params.id,
      dto,
      { coverArt, audioFiles: collectAudioFiles(req) },
      releaseActor(req),
    );
    sendSuccess(res, item, 'Release updated');
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const item = await musicReleaseService.updateStatus(req.params.id, req.body, releaseActor(req));
    sendSuccess(res, item, 'Release status updated');
  });

  bulkUpdateStatus = asyncHandler(async (req: Request, res: Response) => {
    const result = await musicReleaseService.bulkUpdateStatus(req.body, releaseActor(req));
    sendSuccess(res, result, `${result.updated} release(s) updated`);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await musicReleaseService.delete(req.params.id, releaseActor(req));
    sendSuccess(res, null, 'Release deleted');
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const query = exportQuerySchema.parse(req.query);
    const csv = await musicReleaseService.exportCsv(query, releaseActor(req));

    const filename = `music-releases-${query.context}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(`\uFEFF${csv}`);
  });

  serveFile = asyncHandler(async (req: Request, res: Response) => {
    const filePath = resolveLocalReleaseFile(req.params.filename);
    try {
      await fs.access(filePath);
    } catch {
      throw ApiError.notFound('File not found');
    }
    res.sendFile(filePath);
  });
}

export const musicReleaseController = new MusicReleaseController();
