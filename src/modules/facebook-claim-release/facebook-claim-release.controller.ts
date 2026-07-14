import { Request, Response } from 'express';
import { requestActor } from '@/utils/requestActor';
import { facebookClaimReleaseService } from './facebook-claim-release.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ExportQueryDto, ListQueryDto } from './facebook-claim-release.validator';

class FacebookClaimReleaseController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await facebookClaimReleaseService.list(req.query as unknown as ListQueryDto, requestActor(req));
    sendSuccess(res, result.items, 'Claim releases fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await facebookClaimReleaseService.getById(req.params.id, requestActor(req));
    sendSuccess(res, item, 'Claim release fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const item = await facebookClaimReleaseService.create(req.body, requestActor(req));
    sendSuccess(res, item, 'Claim release created', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const item = await facebookClaimReleaseService.update(req.params.id, req.body, requestActor(req));
    sendSuccess(res, item, 'Claim release updated');
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const item = await facebookClaimReleaseService.updateStatus(req.params.id, req.body, requestActor(req));
    sendSuccess(res, item, 'Status updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await facebookClaimReleaseService.remove(req.params.id, requestActor(req));
    sendSuccess(res, null, 'Claim release deleted');
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const csv = await facebookClaimReleaseService.exportCsv(req.query as unknown as ExportQueryDto, requestActor(req));

    const filename = `facebook-claim-releases-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(`\uFEFF${csv}`);
  });
}

export const facebookClaimReleaseController = new FacebookClaimReleaseController();
