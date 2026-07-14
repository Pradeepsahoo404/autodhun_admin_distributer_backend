import { Request, Response } from 'express';
import { requestActor } from '@/utils/requestActor';
import { youtubeClaimReleaseService } from './youtube-claim-release.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ExportQueryDto, ListQueryDto } from './youtube-claim-release.validator';

class YoutubeClaimReleaseController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await youtubeClaimReleaseService.list(req.query as unknown as ListQueryDto, requestActor(req));
    sendSuccess(res, result.items, 'Claim releases fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await youtubeClaimReleaseService.getById(req.params.id, requestActor(req));
    sendSuccess(res, item, 'Claim release fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const item = await youtubeClaimReleaseService.create(req.body, requestActor(req));
    sendSuccess(res, item, 'Claim release created', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const item = await youtubeClaimReleaseService.update(req.params.id, req.body, requestActor(req));
    sendSuccess(res, item, 'Claim release updated');
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const item = await youtubeClaimReleaseService.updateStatus(req.params.id, req.body, requestActor(req));
    sendSuccess(res, item, 'Status updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await youtubeClaimReleaseService.remove(req.params.id, requestActor(req));
    sendSuccess(res, null, 'Claim release deleted');
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const csv = await youtubeClaimReleaseService.exportCsv(req.query as unknown as ExportQueryDto, requestActor(req));

    const filename = `youtube-claim-releases-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(`\uFEFF${csv}`);
  });
}

export const youtubeClaimReleaseController = new YoutubeClaimReleaseController();
